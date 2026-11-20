import { getEnv } from '../config/env.js';

function categoryKey(category) {
  return category.id || category._id?.toString();
}

function compatible(categories, type) {
  return categories.filter((category) => category.kind === 'both' || category.kind === type);
}

function findByLabel(categories, label) {
  if (!label) return null;
  const normalized = String(label).trim().toLowerCase();
  return categories.find((category) => (
    category.name.toLowerCase() === normalized || category.slug === normalized
  )) || null;
}

function ruleBased(input, categories) {
  const haystack = `${input.description || ''} ${input.merchant || ''}`.toLowerCase();
  const pool = compatible(categories, input.type);
  let best = null;

  for (const category of pool) {
    for (const keyword of category.keywords || []) {
      const needle = keyword.toLowerCase();
      if (needle && haystack.includes(needle)) {
        if (!best || needle.length > best.keyword.length) {
          best = { category, keyword: needle };
        }
      }
    }
  }

  if (best) {
    return {
      categoryId: categoryKey(best.category),
      category: best.category.name,
      confidence: 0.66,
      reason: `Matched “${best.keyword}” in the description`,
      source: 'rules',
    };
  }

  const fallback = categories.find((category) => category.slug === 'other') || categories[0];
  return {
    categoryId: fallback ? categoryKey(fallback) : null,
    category: fallback?.name || 'Other',
    confidence: 0.2,
    reason: 'No keyword or model match',
    source: 'rules',
  };
}

async function callLlm(input, categories, fetchImpl) {
  const env = getEnv();
  const allowed = categories.map((category) => category.name).join(', ');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.llmTimeoutMs);
  try {
    const response = await fetchImpl(`${env.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.llmModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You categorize a single personal-finance transaction.',
              `Choose exactly one category from this list: ${allowed}.`,
              'Respond with JSON only: {"category":"<name>","confidence":0.0,"reason":"short reason"}.',
              'confidence is a number from 0 to 1.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              description: input.description,
              merchant: input.merchant || '',
              amount: input.amount,
              type: input.type,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 240)}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM response did not include a message');
    const parsed = JSON.parse(content);
    const confidence = Number(parsed.confidence);
    return {
      category: String(parsed.category || '').trim(),
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
      reason: String(parsed.reason || 'Categorized by model').slice(0, 280),
      source: 'llm',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function categorizeTransaction(input, categories, deps = {}) {
  if (!categories?.length) {
    return {
      categoryId: null,
      category: 'Other',
      confidence: 0,
      reason: 'No categories are configured',
      source: 'rules',
    };
  }

  const env = getEnv();
  if (env.llmApiKey) {
    try {
      const result = await callLlm(input, categories, deps.fetchImpl || globalThis.fetch);
      const match = findByLabel(categories, result.category);
      if (match) {
        return {
          categoryId: categoryKey(match),
          category: match.name,
          confidence: result.confidence,
          reason: result.reason,
          source: 'llm',
        };
      }
    } catch (error) {
      const message = error?.name === 'AbortError' ? 'LLM request timed out' : error.message;
      console.warn(`LLM categorization failed, using keyword rules: ${message}`);
    }
  }

  return ruleBased(input, categories);
}
