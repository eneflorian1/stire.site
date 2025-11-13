import { useEffect, useState } from 'react';
import { createArticle, fetchCategories } from '../api';
import type { Article } from '../types';
import { useNavigate } from 'react-router-dom';

export default function CreateArticle() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [image, setImage] = useState('https://picsum.photos/800/450');
  const [source, setSource] = useState('Stirix');
  const [category, setCategory] = useState<string>('Tech');
  const [cats, setCats] = useState<string[]>(['Tech']);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories().then((x) => setCats(x.filter((c) => c !== 'Toate'))).catch(() => void 0);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || summary.trim().length < 10 || !image.startsWith('http') || !source.trim()) return;
    setSubmitting(true);
    try {
      const payload = { title, summary, image_url: image, source, category, published_at: new Date().toISOString() };
      const created: Article = await createArticle(payload);
      console.log('created', created);
      nav('/');
    } catch (err) {
      alert(`Eroare la publicare: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h2>Creează știre</h2>
      <form onSubmit={onSubmit} className="card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <input className="input" placeholder="Titlu" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="textarea" placeholder="Rezumat (minim 10 caractere)" value={summary} onChange={(e) => setSummary(e.target.value)} required />
          <input className="input" placeholder="Imagine URL" value={image} onChange={(e) => setImage(e.target.value)} required />
          <input className="input" placeholder="Sursă" value={source} onChange={(e) => setSource(e.target.value)} required />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Se salvează...' : 'Publică'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}


