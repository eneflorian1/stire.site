import type { Article } from '../types';
import { Link } from 'react-router-dom';

function formatDayTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ro-RO', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function ArticleCard({ article }: { article: Article }) {
  const slug = slugify(article.title);
  const href = `/article/${slug}--${article.id}`;
  return (
    <Link to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card clickable">
        <img className="cover" src={article.image_url} alt={article.title} loading="lazy" />
        <div className="card-body">
          <span className="chip">{article.category}</span>
          <div className="title line-2">{article.title}</div>
          <div className="summary line-3">{article.summary}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted" title={new Date(article.published_at).toLocaleString('ro-RO')}>
              {formatDayTime(article.published_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}


