'use client';

import { useMemo, useState } from 'react';
import type { Article } from '@/lib/articles';
import type { Category } from '@/lib/categories';
import SearchBar from './search-bar';
import ArticleCard from './article-card';

type Props = {
  articles: Article[];
  categories: Category[];
  initialCategory?: string | null;
};

const ArticlesShell = ({ articles, categories, initialCategory }: Props) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory ?? 'all');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchCategory =
        selectedCategory === 'all' || article.categorySlug === selectedCategory;
      if (!matchCategory) return false;
      if (!normalized) return true;
      const haystack = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [articles, query, selectedCategory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <SearchBar value={query} onChange={setQuery} className="flex-1" />
        <div className="flex flex-col gap-1 md:w-72">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filtreaza dupa categorie
          </label>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="all">Toate categoriile</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
          Nu am gasit articole pentru criteriile selectate.
        </div>
      )}
    </div>
  );
};

export default ArticlesShell;
