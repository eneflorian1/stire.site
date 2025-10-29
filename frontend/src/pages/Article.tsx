import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { fetchArticleDetail } from '../api';
import type { ArticleDetail } from '../types';

function setHeadTag(selector: string, createEl: () => HTMLElement, content: string): void {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = createEl();
    document.head.appendChild(el);
  }
  if (el instanceof HTMLMetaElement) {
    el.content = content;
  } else if (el instanceof HTMLLinkElement) {
    el.href = content;
  }
}

function formatDayTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ro-RO', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ArticlePage() {
  const { id: slugOrId } = useParams();
  const loc = useLocation();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const canonicalUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.origin + loc.pathname : ''), [loc.pathname]);

  useEffect(() => {
    if (!slugOrId) return;
    setLoading(true);
    fetchArticleDetail(slugOrId)
      .then(setArticle)
      .finally(() => setLoading(false));
  }, [slugOrId]);

  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} – Stirix`;
    const desc = article.meta_description || (article.summary || '').slice(0, 160);
    setHeadTag('meta[name="description"]', () => {
      const m = document.createElement('meta');
      m.name = 'description';
      return m;
    }, desc);
    setHeadTag('link[rel="canonical"]', () => {
      const l = document.createElement('link');
      l.rel = 'canonical';
      return l;
    }, canonicalUrl);
    // Open Graph
    setHeadTag('meta[property="og:title"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:title');
      return m;
    }, article.title);
    setHeadTag('meta[property="og:description"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:description');
      return m;
    }, desc);
    setHeadTag('meta[property="og:image"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:image');
      return m;
    }, article.image_url);
    setHeadTag('meta[property="og:type"]', () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:type');
      return m;
    }, 'article');
    // Twitter Card
    setHeadTag('meta[name="twitter:card"]', () => {
      const m = document.createElement('meta');
      m.name = 'twitter:card';
      return m;
    }, 'summary_large_image');
  }, [article, canonicalUrl]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="muted">Se încarcă articolul...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container" style={{ paddingTop: 24 }}>
        <div className="muted">Articolul nu a fost găsit.</div>
      </div>
    );
  }

  return (
    <div className="container article-page" style={{ paddingTop: 24, maxWidth: 860 }}>
      <article className="card" style={{ overflow: 'hidden' }}>
        <img className="cover" src={article.image_url} alt={article.title} style={{ height: 320 }} />
        <div className="card-body">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="chip">{article.category}</span>
          </div>
          <h1 className="article-title">{article.title}</h1>
          <div className="muted" title={new Date(article.published_at).toLocaleString('ro-RO')}>
            {article.source} · {formatDayTime(article.published_at)}
          </div>
          <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content_html }} />
        </div>
      </article>
    </div>
  );
}


