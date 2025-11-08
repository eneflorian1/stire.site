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
  const [w, setW] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
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

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDesktop = w >= 992;

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
    <div className="container article-page" style={{ paddingTop: isDesktop ? 32 : 24, maxWidth: isDesktop ? 1100 : 860 }}>
      <article className="card" style={{ overflow: 'hidden' }}>
       
        <div className="card-body" style={{ padding: isDesktop ? '20px 28px 28px' : undefined }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isDesktop ? 2 : 6 }}>
            
          </div>
          <h1
            className="article-title"
            style={{
              fontSize: isDesktop ? 28 : 32,
              lineHeight: isDesktop ? 1.25 : 1.2,
              margin: isDesktop ? '6px 0 10px' : undefined,
              letterSpacing: isDesktop ? 0.2 : undefined,
            }}
          >
            {article.title}
          </h1>
          <div
            className="muted"
            title={new Date(article.published_at).toLocaleString('ro-RO')}
            style={{ fontSize: isDesktop ? 12 : 13, marginBottom: isDesktop ? 12 : 10 }}
          >
            {article.source} · {formatDayTime(article.published_at)}
          </div>
          {/* Nu afișăm imaginea dacă este placeholder (data URI SVG) */}
          {!article.image_url.startsWith('data:image/svg+xml') ? (
            <div style={{ position: 'relative', marginBottom: isDesktop ? 16 : 12 }}>
              <img
                className="cover"
                src={article.image_url}
                alt={article.title}
                style={{ height: isDesktop ? 420 : 260, objectFit: 'cover', width: '100%', display: 'block' }}
              />
              <span
                className="chip"
                style={{ position: 'absolute', top: 12, right: 12, fontSize: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '4px 8px', borderRadius: 999 }}
              >
                {article.category}
              </span>
            </div>
          ) : (
            /* Afișăm doar categoria când nu există imagine */
            <div style={{ marginBottom: isDesktop ? 16 : 12 }}>
              <span
                className="chip"
                style={{ fontSize: 12, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '4px 8px', borderRadius: 999, display: 'inline-block' }}
              >
                {article.category}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '100%',
                maxWidth: isDesktop ? 740 : 820,
                fontSize: isDesktop ? 17 : 18,
                lineHeight: isDesktop ? 1.7 : 1.65,
                letterSpacing: isDesktop ? 0.1 : 0.2,
                color: 'var(--text)',
                textAlign: 'justify',
                textJustify: 'inter-word' as any,
                display: 'flex',
                flexDirection: 'column',
                gap: isDesktop ? 14 : 12,
                wordBreak: 'break-word',
                hyphens: 'auto',
              }}
              className="article-content"
              dangerouslySetInnerHTML={{ __html: article.content_html }}
            />
          </div>
        </div>
      </article>
    </div>
  );
}



