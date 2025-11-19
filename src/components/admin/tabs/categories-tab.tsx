'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Category } from '@/lib/categories';
import { buttonGhost, buttonPrimary, chipStyles, inputStyles, labelStyles, sectionCard } from '../tab-styles';

const CategoriesTab = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('Nu am putut incarca categoriile.');
      const data = await response.json();
      setCategories(data.categories ?? []);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Nu am putut incarca categoriile.';
      setMessage(detail);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut crea categoria.');
      }
      await fetchCategories();
      setForm({ name: '' });
      setMessage('Categoria a fost salvata cu succes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la salvarea categoriei.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCategorySelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) {
      setMessage('Selecteaza cel putin o categorie pentru stergere.');
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut sterge categoriile.');
      }
      setCategories(payload.categories ?? []);
      setSelectedIds([]);
      setMessage(`Au fost sterse ${payload.deleted ?? 0} categorii.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la stergerea categoriilor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
      <form onSubmit={submitCategory} className={sectionCard}>
        <h2 className="text-lg font-semibold text-slate-900">Adauga categorie</h2>
        <div className="mt-6 space-y-4">
          <div>
            <label className={labelStyles} htmlFor="category-name">
              Nume
            </label>
            <input
              id="category-name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className={inputStyles}
              placeholder="Economie, Politic..."
            />
          </div>
          <button type="submit" className={buttonPrimary} disabled={isSubmitting}>
            {isSubmitting ? 'Salvam...' : 'Salveaza categoria'}
          </button>
          {message && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
          )}
        </div>
      </form>
      <div className={sectionCard}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Categorii existente</h2>
            <span className={chipStyles}>Total: {categories.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={buttonGhost}
              onClick={() => setSelectedIds(categories.map((c) => c.id))}
              disabled={categories.length === 0}
            >
              Selecteaza toate
            </button>
            <button
              type="button"
              className={buttonPrimary}
              onClick={deleteSelected}
              disabled={isSubmitting || selectedIds.length === 0}
            >
              Sterge selectate
            </button>
          </div>
        </div>
        <ul className="mt-6 space-y-3 text-sm text-slate-600">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 text-sm text-slate-600"
            >
              <div className="flex w-full items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-slate-900">{category.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{category.slug}</span>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  checked={selectedIds.includes(category.id)}
                  onChange={() => toggleCategorySelection(category.id)}
                />
              </div>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
              Nu exista categorii inca.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CategoriesTab;
