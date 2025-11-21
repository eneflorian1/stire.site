'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { BannerSettings } from '@/lib/banner';
import { buttonPrimary, inputStyles, labelStyles, sectionCard } from '../tab-styles';

const emptyForm = {
  title: '',
  imageUrl: '',
  animated: false,
  notes: '',
};

const BannerTab = () => {
  const [settings, setSettings] = useState<BannerSettings | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchBanner = useCallback(async () => {
    const response = await fetch('/api/banner');
    if (!response.ok) throw new Error('Nu am putut incarca bannerul.');
    const data = await response.json();
    setSettings(data.banner);
    setForm({
      title: data.banner?.title ?? '',
      imageUrl: data.banner?.imageUrl ?? '',
      animated: Boolean(data.banner?.animated),
      notes: data.banner?.notes ?? '',
    });
  }, []);

  useEffect(() => {
    fetchBanner().catch((error) => setMessage(error instanceof Error ? error.message : null));
  }, [fetchBanner]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = event.target;
    const { name, type } = target;
    if (type === 'checkbox' && 'checked' in target) {
      setForm((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: target.value,
      }));
    }
  };

  const submitBanner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const file = fileInputRef.current?.files?.[0];
      let response: Response;

      if (file) {
        const data = new FormData();
        data.append('title', form.title);
        data.append('notes', form.notes);
        data.append('animated', String(form.animated));
        data.append('file', file);
        response = await fetch('/api/banner', {
          method: 'POST',
          body: data,
        });
      } else {
        response = await fetch('/api/banner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut salva bannerul.');
      setSettings(payload.banner);
      setMessage('Bannerul a fost actualizat.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la salvare.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submitBanner} className={sectionCard}>

      <div className="mt-6 space-y-4">
        <div>
          <label className={labelStyles} htmlFor="banner-title">
            Titlu banner
          </label>
          <input
            id="banner-title"
            name="title"
            value={form.title}
            onChange={handleChange}
            className={inputStyles}
            required
            placeholder="Banner reclama (imagine/GIF cu link catre de-vanzare.ro)"
          />
        </div>
        <div>
          <label className={labelStyles} htmlFor="banner-image">
            URL imagine sau GIF
          </label>
          <input
            id="banner-image"
            name="imageUrl"
            value={form.imageUrl}
            onChange={handleChange}
            className={inputStyles}
            required
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelStyles} htmlFor="banner-file">
            Sau incarca fisier (JPG/PNG/GIF)
          </label>
          <input
            ref={fileInputRef}
            id="banner-file"
            type="file"
            accept="image/*,image/gif"
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
          />
          <p className="mt-1 text-xs text-slate-500">
            Daca selectezi un fisier, acesta va fi incarcat in site si folosit ca banner, ignorand
            URL-ul de mai sus.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="banner-animated"
            name="animated"
            checked={form.animated}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
          <label htmlFor="banner-animated" className="text-sm text-slate-600">
            Foloseste banner animat (in loc de imagine)
          </label>
        </div>
        <div>
          <label className={labelStyles} htmlFor="banner-notes">
            Nota
          </label>
          <textarea
            id="banner-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className={inputStyles}
            rows={4}
            placeholder="Accepta JPG/PNG/GIF. Bannerul de pe desktop este afisat sub stirea principala..."
          />
        </div>
        <button type="submit" className={buttonPrimary} disabled={isSaving}>
          {isSaving ? 'Publicam...' : 'Publica banner'}
        </button>
        {settings?.updatedAt && (
          <p className="text-xs text-slate-400">
            Ultima actualizare: {new Date(settings.updatedAt).toLocaleString('ro-RO')}
          </p>
        )}
      </div>
      {message && (
        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      )}
    </form>
  );
};

export default BannerTab;
