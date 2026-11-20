import { DEFAULT_CATEGORIES } from '../constants/categories.js';
import { Category } from '../models/Category.js';

export async function ensureDefaultCategories() {
  const count = await Category.estimatedDocumentCount();
  if (count > 0) return;
  await Category.insertMany(DEFAULT_CATEGORIES);
}

export async function listCategories() {
  return Category.find().sort({ name: 1 });
}

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
