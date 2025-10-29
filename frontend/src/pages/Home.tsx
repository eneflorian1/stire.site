import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchArticles } from '../api';
import type { Article } from '../types';
import { ArticleCard } from '../components/ArticleCard';

export default function Home() {
  const loc = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState<string>('');
  const [cat, setCat] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

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

  // pick up q and cat from URL
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    setQ(params.get('q') ?? '');
    const c = params.get('cat') ?? undefined;
    setCat(c ?? undefined);
  }, [loc.search]);

  return (
    <div>
      <div className="container">
        {loading ? (
          <div className="muted">Se încarcă...</div>
        ) : (
          <div className="grid">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


