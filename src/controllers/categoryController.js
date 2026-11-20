import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { presentCategory } from '../utils/presenters.js';
import { slugify } from '../services/categoryService.js';

function normalizeKeywords(keywords = []) {
  return [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))];
}

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ success: true, data: categories.map(presentCategory) });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, kind, keywords } = req.validated.body;
  const category = await Category.create({
    name,
    slug: slugify(name),
    kind,
    keywords: normalizeKeywords(keywords),
    isSystem: false,
  });
  res.status(201).json({ success: true, data: presentCategory(category) });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.validated.params.id);
  if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
  const { name, kind, keywords } = req.validated.body;
  if (name !== undefined) {
    category.name = name;
    category.slug = slugify(name);
  }
  if (kind !== undefined) category.kind = kind;
  if (keywords !== undefined) category.keywords = normalizeKeywords(keywords);
  await category.save();
  res.json({ success: true, data: presentCategory(category) });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.validated.params.id);
  if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
  const inUse = await Transaction.exists({ category: category._id });
  if (inUse) {
    throw new AppError('Category is used by transactions', 409, 'CATEGORY_IN_USE');
  }
  await category.deleteOne();
  res.status(204).send();
});
