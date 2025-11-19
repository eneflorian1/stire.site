'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Article } from '@/lib/articles';
import type { Category } from '@/lib/categories';
import { buttonGhost, buttonPrimary, chipStyles, inputStyles, labelStyles, sectionCard } from '../tab-styles';

type ArticleFormState = {
  title: string;
  category: string;
  content: string;
  imageUrl: string;
  status: Article['status'];
  publishedAt: string;
  hashtags: string;
};

const emptyForm: ArticleFormState = {
  title: '',
  category: '',
  content: '',
  imageUrl: '',
  status: 'published',
  publishedAt: '',
  hashtags: '',
};

const ArticlesTab = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [form, setForm] = useState<ArticleFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'recente' | 'creeaza'>('recente');

  const fetchArticles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/articles');
      if (!response.ok) throw new Error('Nu am putut incarca articolele.');
      const data = await response.json();
      setArticles(data.articles ?? []);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Nu am putut incarca articolele.';
      setMessage(detail);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('Nu am putut incarca categoriile.');
      const data = await response.json();
      setCategories(data.categories ?? []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [fetchArticles, fetchCategories]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const autoSummary = form.content.trim().slice(0, 300);
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, summary: autoSummary }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut crea articolul.');
      }
      setArticles((prev) => [payload.article, ...prev]);
      setForm(emptyForm);
      await fetchArticles();
      setMessage(
        payload.submission?.success
          ? 'Articol publicat si trimis catre Google Indexing.'
          : payload.submission?.skipped
          ? 'Articol publicat, dar trimiterea catre Google a fost sarita.'
          : 'Articol publicat. Verifica logurile Google Indexing.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la publicarea articolului.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishedCount = useMemo(
    () => articles.filter((a) => a.status === 'published').length,
    [articles]
  );
  const draftCount = useMemo(
    () => articles.filter((a) => a.status === 'draft').length,
    [articles]
  );
  const categoryCount = useMemo(
    () => new Set(articles.map((a) => a.categorySlug)).size,
    [articles]
  );

  const toggleArticleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const deleteSelectedArticles = async () => {
    if (selectedIds.length === 0) {
      setMessage('Selecteaza cel putin un articol pentru stergere.');
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/articles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut sterge articolele.');
      }
      setArticles(payload.articles ?? []);
      setSelectedIds([]);
      setMessage(`Au fost sterse ${payload.deleted ?? 0} articole.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la stergerea articolelor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs">
          {(['recente', 'creeaza'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveSubTab(tab)}
              className={`rounded-full px-3 py-1 transition ${
                activeSubTab === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {tab === 'recente' ? 'Recente' : 'Creeaza articol'}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === 'creeaza' && (
        <form onSubmit={submitArticle} className={sectionCard} id="admin-create-article">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Creeaza articol</h2>
            <p className="text-sm text-slate-500">Swift form, actualizari instant.</p>
          </div>
          <button type="submit" className={buttonPrimary} disabled={isSubmitting}>
            {isSubmitting ? 'Publicam...' : 'Publica articolul'}
          </button>
        </div>
        <div className="mt-6 grid gap-4">
          <div>
            <label className={labelStyles} htmlFor="title">
              Titlu
            </label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className={inputStyles}
              placeholder="Banca Mondiala a anuntat noi reglementari"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelStyles} htmlFor="category">
                Categorie
              </label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className={inputStyles}
              >
                <option value="">Alege o categorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelStyles} htmlFor="imageUrl">
                URL imagine / GIF
              </label>
              <input
                id="imageUrl"
                name="imageUrl"
                value={form.imageUrl}
                onChange={handleChange}
                className={inputStyles}
                placeholder="https://cdn.stire.site/img.jpg"
              />
            </div>
          </div>
          <div>
            <label className={labelStyles} htmlFor="content">
              Continut
            </label>
            <textarea
              id="content"
              name="content"
              value={form.content}
              onChange={handleChange}
              required
              rows={8}
              className={inputStyles}
              placeholder="Text complet al stirii."
            />
          </div>
          <div>
            <label className={labelStyles} htmlFor="hashtags">
              Hashtags (optional)
            </label>
            <input
              id="hashtags"
              name="hashtags"
              value={form.hashtags}
              onChange={handleChange}
              className={inputStyles}
              placeholder="economic, energie, romania"
            />
            <p className="mt-1 text-xs text-slate-500">
              Separate prin virgula, fara simbolul #. Vor fi afisate la finalul articolului.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelStyles} htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className={inputStyles}
              >
                <option value="published">Publicat</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelStyles} htmlFor="publishedAt">
                Data publicarii
              </label>
              <input
                type="datetime-local"
                id="publishedAt"
                name="publishedAt"
                value={form.publishedAt}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>
          </div>
        </div>
        {message && (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
        )}
      </form>
      )}

      {activeSubTab === 'recente' && (
        <div className={sectionCard}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Articole recente</h2>
              <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                <span className={chipStyles}>Publicate: {publishedCount}</span>
                <span className={chipStyles}>Drafturi: {draftCount}</span>
                <span className={chipStyles}>Categorii: {categoryCount}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={buttonGhost}
                onClick={fetchArticles}
                disabled={isLoading}
              >
                Reincarca
              </button>
              <button
                type="button"
                className={buttonGhost}
                onClick={() => setSelectedIds(articles.map((a) => a.id))}
                disabled={articles.length === 0}
              >
                Selecteaza toate
              </button>
              <button
                type="button"
                className={buttonPrimary}
                onClick={deleteSelectedArticles}
                disabled={isSubmitting || selectedIds.length === 0}
              >
                Sterge selectate
              </button>
            </div>
          </div>
          {isLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Se incarca articolele...
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {articles.slice(0, 20).map((article) => (
                <li
                  key={article.id}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase text-slate-400">{article.category}</p>
                        <p className="text-base font-semibold text-slate-900">{article.title}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-slate-400">
                          {new Date(article.publishedAt).toLocaleDateString('ro-RO')}
                        </span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          checked={selectedIds.includes(article.id)}
                          onChange={() => toggleArticleSelection(article.id)}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{article.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <span className={chipStyles}>{article.status}</span>
                      <span className="font-mono text-slate-500">{article.slug}</span>
                      <a
                        href={`/Articol/${article.categorySlug}/${article.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-500 hover:text-sky-600"
                      >
                        Vezi live &gt;
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ArticlesTab;
