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

export function ArticleCard({ article, variant }: { article: Article; variant?: 'featured' | 'banner' }) {
  const slug = slugify(article.title);
  const href = `/article/${slug}--${article.id}`;
  const isFeatured = variant === 'featured';
  const isBanner = variant === 'banner';
  // Detectează placeholder-ul (data URI SVG gri)
  const isPlaceholder = article.image_url.startsWith('data:image/svg+xml');
  
  return (
    <Link to={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card clickable">
        <div style={{ position: 'relative' }}>
          {isPlaceholder ? (
            <div 
              className="cover" 
              style={{ 
                backgroundColor: '#e5e7eb', 
                height: isBanner ? 360 : (isFeatured ? 260 : undefined),
                width: '100%',
                display: 'block'
              }} 
            />
          ) : (
            <img className="cover" src={article.image_url} alt={article.title} loading="lazy" style={isBanner ? { height: 360 } : (isFeatured ? { height: 260 } : undefined)} />
          )}
          <span className="chip" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '4px 8px' }}>{article.category}</span>
        </div>
        <div className="card-body">
          <div className={isBanner ? 'title line-3' : (isFeatured ? 'title line-3' : 'title line-2')} style={isBanner ? { fontSize: 20, lineHeight: 1.35 } : (isFeatured ? { fontSize: 18, lineHeight: 1.4 } : undefined)}>{article.title}</div>
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


