'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Article } from '@/lib/articles';
import type { BannerSettings } from '@/lib/banner';
import type { Category } from '@/lib/categories';
import ArticleCard from './article-card';

type Props = {
  articles: Article[];
  categories: Category[];
  banner?: BannerSettings | null;
};

const HomeShell = ({ articles, categories, banner }: Props) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setQuery(custom.detail ?? '');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('home-search-change', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('home-search-change', handler as EventListener);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const normalized = query.trim().toLowerCase();
    return articles.filter((article) => {
      const values = [article.title, article.summary, article.category];
      return values.some((value) => value.toLowerCase().includes(normalized));
    });
  }, [articles, query]);

  const featured = filtered[0];
  const side = filtered.slice(1, 3);
  const rest = filtered.slice(3);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
      <section className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div>
            {featured ? (
              <ArticleCard article={featured} variant="featured" />
            ) : (
              <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10">
                <div className="text-center">
                  <p className="text-lg font-medium text-slate-900">Nu am gasit articole pentru cautarea ta.</p>
                  <p className="mt-2 text-sm text-slate-500">Incearca alte cuvinte cheie sau navighează prin categorii.</p>
                </div>
              </div>
            )}
          </div>
          {banner?.imageUrl && <BannerPanel banner={banner} />}
        </div>
        <div className="flex flex-col gap-4 md:col-span-1">
          {side.length > 0 &&
            side.map((article) => (
              <ArticleCard key={article.id} article={article} variant="compact" />
            ))
          }
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

const BannerPanel = ({ banner }: { banner: BannerSettings }) => (
  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <img
      src={banner.imageUrl}
      alt={banner.title}
      className="h-full w-full object-cover"
    />
  </div>
);

export default HomeShell;
