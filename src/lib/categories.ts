import { randomUUID } from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './json-store';
import { slugify } from './strings';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'categories.json');

const normalizeCategory = (category: Partial<Category>): Category | null => {
  if (!category.name) return null;
  const normalizedName = category.name.trim();
  if (!normalizedName) return null;

  const slug = category.slug ?? slugify(normalizedName);
  const now = new Date().toISOString();
  return {
    id: category.id ?? randomUUID(),
    name: normalizedName,
    slug: slug || slugify(normalizedName) || normalizedName,
    description: category.description?.trim(),
    createdAt: category.createdAt ?? now,
    updatedAt: category.updatedAt ?? now,
  };
};

export const getCategories = async (): Promise<Category[]> => {
  const data = await readJsonFile<Category[]>(DATA_PATH, []);
  return data
    .map((item) => normalizeCategory(item))
    .filter((item): item is Category => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const createCategory = async (input: { name: string; description?: string }) => {
  const categories = await getCategories();
  const normalizedName = input.name.trim();
  const slug = slugify(normalizedName) || normalizedName;

  if (categories.some((category) => category.slug === slug)) {
    return categories.find((category) => category.slug === slug) as Category;
  }

  const now = new Date().toISOString();
  const category: Category = {
    id: randomUUID(),
    name: normalizedName,
    slug,
    description: input.description?.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const updated = [...categories, category];
  await writeJsonFile(DATA_PATH, updated);
  return category;
};

export const ensureCategoryRecord = async (name: string) => {
  const normalizedName = name.trim();
  if (!normalizedName) return null;
  const slug = slugify(normalizedName) || normalizedName;
  const categories = await getCategories();
  if (categories.some((category) => category.slug === slug)) {
    return categories.find((category) => category.slug === slug);
  }

  return createCategory({ name: normalizedName });
};
