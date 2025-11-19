import Link from 'next/link';
import type { Article } from '@/lib/articles';

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
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6">
          <h3 className="text-2xl font-semibold text-slate-900">{article.title}</h3>
          <span className="text-sm text-slate-500">{formattedDate}</span>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-sm transition hover:-translate-y-1"
      >
        <span className="absolute right-4 top-4 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow">
          {article.category}
        </span>
        <div className="relative h-28 w-full overflow-hidden rounded-2xl bg-slate-100" aria-hidden>
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: imageBackground }}
          />
        </div>
        <p className="line-clamp-3 text-base font-semibold text-slate-900">{article.title}</p>
        <span className="text-xs text-slate-400">{formattedDate}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-8 text-slate-700 shadow-sm transition hover:-translate-y-1"
    >
      <div className="relative -mx-4 -mt-4 h-40 w-[calc(100%+2rem)] overflow-hidden bg-slate-100">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{ backgroundImage: imageBackground }}
          aria-hidden
        />
      </div>
      <span className="absolute right-4 top-4 rounded-full bg-slate-900/90 px-2 py-0.5 text-xs font-semibold text-white">
        {article.category}
      </span>
      <h3 className="text-lg font-semibold text-slate-900">{article.title}</h3>
      <span className="text-xs text-slate-500">{formattedDate}</span>
    </Link>
  );
};

export default ArticleCard;
