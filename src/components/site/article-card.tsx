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
  const imageBackground = article.imageUrl
    ? `url(${article.imageUrl})`
    : 'linear-gradient(135deg, #ede9fe, #eef2ff)';

  if (variant === 'featured') {
    return (
      <Link
        href={article.url}
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1"
      >
        <div
          className="h-64 w-full bg-cover bg-center"
          style={{ backgroundImage: imageBackground }}
          aria-hidden
        />
        <div className="flex flex-1 flex-col gap-3 p-6">
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {article.category}
          </span>
          <h3 className="text-xl font-semibold text-slate-900">{article.title}</h3>
          <p className="text-sm text-slate-600">{article.summary}</p>
          <span className="text-xs text-slate-400">{formattedDate}</span>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={article.url}
        className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-sm transition hover:-translate-y-1"
      >
        <div
          className="h-24 w-full rounded-2xl bg-cover bg-center"
          style={{ backgroundImage: imageBackground }}
          aria-hidden
        />
        <p className="line-clamp-3 text-slate-900">{article.title}</p>
        <span className="text-xs text-slate-400">{formattedDate}</span>
      </Link>
    );
  }

  return (
    <Link
      href={article.url}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 shadow-sm transition hover:-translate-y-1"
    >
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
          {article.category}
        </span>
        {formattedDate}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{article.title}</h3>
      <p className="text-sm text-slate-600 line-clamp-3">{article.summary}</p>
    </Link>
  );
};

export default ArticleCard;
