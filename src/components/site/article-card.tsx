'use client';

import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Article } from '@/lib/articles';
import { isArticleSaved, toggleSavedArticle } from '@/lib/saved-articles';

type Props = {
  article: Article;
  variant?: 'featured' | 'compact' | 'default';
};

const ArticleCard = ({ article, variant = 'default' }: Props) => {
  const formattedDate = new Date(article.publishedAt).toLocaleString('ro-RO', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const href = `/Articol/${article.categorySlug}/${article.slug}`;
  const imageBackground = article.imageUrl
    ? `url(${article.imageUrl})`
    : 'linear-gradient(135deg, #ede9fe, #eef2ff)';

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setIsSaved(isArticleSaved(article.id));
  }, [article.id]);

  const handleBookmarkClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    const newSavedStatus = toggleSavedArticle(article.id);
    setIsSaved(newSavedStatus);
  };

  const BookmarkButton = () => (
    <button
      type="button"
      onClick={handleBookmarkClick}
      className="absolute left-4 top-4 z-10 rounded-full bg-white/90 p-2 shadow transition hover:bg-white hover:scale-110"
      aria-label={isSaved ? 'Elimină din salvate' : 'Salvează articol'}
    >
      <Bookmark
        className={`h-4 w-4 transition ${isSaved ? 'fill-slate-900 text-slate-900' : 'text-slate-600'
          }`}
      />
    </button>
  );


  if (variant === 'featured') {
    return (
      <Link
        href={href}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1"
      >
        <div className="relative h-72 w-full overflow-hidden bg-slate-100">
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: imageBackground }}
            aria-hidden
          />
          <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            {article.category}
          </span>
          <BookmarkButton />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6">
          <h3 className="text-xl font-semibold text-slate-900 text-left md:text-2xl">
            {article.title}
          </h3>
          <span className="text-sm text-slate-500" suppressHydrationWarning>{formattedDate}</span>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-sm text-slate-600 shadow-sm transition hover:-translate-y-1"
      >
        <div className="relative h-28 w-full overflow-hidden bg-slate-100" aria-hidden>
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: imageBackground }}
          />
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow">
          {article.category}
        </span>
        <BookmarkButton />
        <div className="flex flex-col gap-3 p-4">
          <p className="line-clamp-3 text-base font-semibold text-slate-900 text-left">
            {article.title}
          </p>
          <span className="text-xs text-slate-400" suppressHydrationWarning>{formattedDate}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-1"
    >
      <div className="relative h-40 w-full overflow-hidden bg-slate-100">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{ backgroundImage: imageBackground }}
          aria-hidden
        />
      </div>
      <span className="absolute right-4 top-4 rounded-full bg-slate-900/90 px-2 py-0.5 text-xs font-semibold text-white">
        {article.category}
      </span>
      <BookmarkButton />
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-base font-semibold text-slate-900 text-left md:text-lg">
          {article.title}
        </h3>
        <span className="text-xs text-slate-500" suppressHydrationWarning>{formattedDate}</span>
      </div>
    </Link>
  );
};

export default ArticleCard;
