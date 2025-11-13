import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchArticles, fetchAnnouncements } from '../api';
import type { Article, Announcement } from '../types';
import { ArticleCard } from '../components/ArticleCard';

export default function HomeDesktop() {
  const loc = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState<string>('');
  const [cat, setCat] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [adUrl, setAdUrl] = useState<string | null>(null);
  const [adAlt, setAdAlt] = useState<string>('');
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const list = await fetchArticles({ category: cat, q });
        setArticles(list);
      } finally {
        setLoading(false);
      }
    },
    [cat, q]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    setQ(params.get('q') ?? '');
    const c = params.get('cat') ?? undefined;
    setCat(c ?? undefined);
  }, [loc.search]);

  // Load latest announcement (image/gif URL in content) for desktop ad slot
  useEffect(() => {
    fetchAnnouncements()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const first = list[0];
          setAnnouncement(first);
          // Check if animated banner is enabled (explicitly true)
          if (first.use_animated_banner === true) {
            setAdUrl(null);
            setAdAlt('');
          } else {
            const url = (first.content || '').trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              setAdUrl(url);
              setAdAlt(first.title || 'Anunț');
            } else {
              setAdUrl(null);
              setAdAlt('');
            }
          }
        } else {
          setAdUrl(null);
          setAdAlt('');
          setAnnouncement(null);
        }
      })
      .catch(() => {
        setAdUrl(null);
        setAdAlt('');
        setAnnouncement(null);
      });
  }, []);

  return (
    <div>
      <div className="container">
        {loading ? (
          <div className="muted">Se încarcă...</div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 24,
              marginBottom: 24
            }}>
              {/* Stânga: banner mare + slot reclamă în spațiul gol */}
              <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {articles[0] ? <ArticleCard article={articles[0]} variant="banner" /> : null}
                {announcement?.use_animated_banner === true ? (
                  <a href="https://de-vanzare.ro" target="_blank" rel="nofollow noopener" style={{ display: 'block', textDecoration: 'none' }}>
                    <div className="animated-banner">
                      <div className="animated-banner-text">
                        de-Vanzare<span>.ro</span>
                      </div>
                    </div>
                  </a>
                ) : adUrl ? (
                  <a href="https://de-vanzare.ro" target="_blank" rel="nofollow noopener" style={{ display: 'block' }}>
                    <img src={adUrl} alt={adAlt} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                  </a>
                ) : null}
              </div>
              {/* Dreapta: două știri */}
              <aside style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {articles[1] ? <ArticleCard article={articles[1]} /> : null}
                {articles[2] ? <ArticleCard article={articles[2]} /> : null}
              </aside>
            </div>

            {/* Jos: grilă pe 3 coloane */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24
            }}>
              {articles.slice(3).map((a) => (
                <ArticleCard key={`bottom-${a.id}`} article={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


