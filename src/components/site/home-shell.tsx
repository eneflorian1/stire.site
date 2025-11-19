'use client';

import { useMemo, useState } from 'react';
import type { Article } from '@/lib/articles';
import type { Category } from '@/lib/categories';
import SearchBar from './search-bar';
import ArticleCard from './article-card';

type Props = {
  articles: Article[];
  categories: Category[];
};

const HomeShell = ({ articles, categories }: Props) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const normalized = query.trim().toLowerCase();
    return articles.filter((article) => {
      const values = [article.title, article.summary, article.category];
      return values.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [articles, query]);

  const featured = filtered[0];
  const side = filtered.slice(1, 4);
  const rest = filtered.slice(4);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Cauta stiri, categorii, topicuri..."
        showMenuButton
      />

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        {featured ? (
          <ArticleCard article={featured} variant="featured" />
        ) : (
          <EmptyState message="Nu am gasit articole pentru cautarea ta." />
        )}
        <div className="space-y-4">
          {side.map((article) => (
            <ArticleCard key={article.id} article={article} variant="compact" />
          ))}
          {side.length === 0 && featured && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Utilizeaza campul de cautare pentru a explora alte articole.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Articole recente ({filtered.length})</span>
          <span>Categorii disponibile: {categories.length}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {rest.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
        {rest.length === 0 && featured && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Ai ajuns la capatul listei. Cauta alte cuvinte cheie pentru inspiratie.
          </div>
        )}
      </section>
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

export default HomeShell;
