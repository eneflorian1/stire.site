import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchCategories } from '../api';

export default function Categories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const nav = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cats = await fetchCategories();
        if (active) setCategories(cats);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const onPick = (cat: string) => {
    const params = new URLSearchParams();
    params.set('cat', cat);
    nav({ pathname: '/', search: `?${params.toString()}` });
  };

  return (
    <div className="container">
      <h2 style={{ marginTop: 8, marginBottom: 16 }}>Categorii</h2>
      {loading ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <div className="categories-grid">
          {categories.map((c) => (
            <button key={c} className="category-tile" onClick={() => onPick(c)}>
              <span>{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


