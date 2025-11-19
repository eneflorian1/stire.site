'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { buttonGhost, buttonPrimary, inputStyles, labelStyles, sectionCard } from '../tab-styles';

type SMGoogleLog = {
  id: string;
  url: string;
  status: 'success' | 'skipped' | 'error';
  detail: string;
  createdAt: string;
  source: 'auto' | 'manual';
};

type SMGoogleLink = {
  url: string;
  lastStatus: string;
  createdAt: string;
};

type CredentialsState =
  | { source: 'env'; hasValue: true }
  | { source: 'stored'; json: string; updatedAt: string | null }
  | { source: 'missing' };

type ViewTab = 'status' | 'logs';

const SMGoogleTab = () => {
  const [logs, setLogs] = useState<SMGoogleLog[]>([]);
  const [links, setLinks] = useState<SMGoogleLink[]>([]);
  const [smUrl, setSmUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [credentials, setCredentials] = useState<CredentialsState | null>(null);
  const [credentialsJson, setCredentialsJson] = useState('');
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  const [activeTab, setActiveTab] = useState<ViewTab>('status');

  const fetchSmData = useCallback(async () => {
    const response = await fetch('/api/smgoogle');
    if (!response.ok) throw new Error('Nu am putut incarca logurile Google.');
    const data = await response.json();
    setLogs(data.logs ?? []);
    setLinks(data.links ?? []);
  }, []);

  const fetchCredentials = useCallback(async () => {
    const response = await fetch('/api/smgoogle/credentials');
    if (!response.ok) throw new Error('Nu am putut incarca credentialele.');
    const data = await response.json();
    setCredentials(data);
    if (data?.source === 'stored' && typeof data.json === 'string') {
      setCredentialsJson(data.json);
    }
  }, []);

  useEffect(() => {
    fetchSmData().catch((error) => setMessage(error instanceof Error ? error.message : null));
    fetchCredentials().catch((error) =>
      setCredentialsMessage(error instanceof Error ? error.message : null)
    );
  }, [fetchSmData, fetchCredentials]);

  const submitManualUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!smUrl.trim()) {
      setMessage('Introdu URL-ul de trimis.');
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/smgoogle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: smUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut trimite URL-ul.');
      await fetchSmData();
      setSmUrl('');
      setMessage(
        payload.submission?.success
          ? 'Link trimis cu succes catre Google Indexing.'
          : payload.submission?.skipped
          ? 'Trimiterea a fost sarita.'
          : payload.submission?.error ?? 'Google a returnat o eroare.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la trimitere.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveCredentials = async () => {
    if (!credentialsJson.trim()) {
      setCredentialsMessage('Introdu JSON-ul complet al service account-ului.');
      return;
    }
    setIsSavingCredentials(true);
    setCredentialsMessage(null);
    try {
      const response = await fetch('/api/smgoogle/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: credentialsJson }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut salva credentialele.');
      setCredentials(payload);
      setCredentialsJson(payload.json ?? '');
      setCredentialsMessage('Credentialele au fost salvate.');
    } catch (error) {
      setCredentialsMessage(
        error instanceof Error ? error.message : 'Eroare la salvarea credentialelor.'
      );
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const deleteCredentials = async () => {
    setIsSavingCredentials(true);
    setCredentialsMessage(null);
    try {
      const response = await fetch('/api/smgoogle/credentials', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut sterge credentialele.');
      setCredentials(payload);
      setCredentialsJson('');
      setCredentialsMessage('Credentialele au fost sterse.');
    } catch (error) {
      setCredentialsMessage(
        error instanceof Error ? error.message : 'Eroare la stergerea credentialelor.'
      );
    } finally {
      setIsSavingCredentials(false);
    }
  };

  return (
    <div className={sectionCard}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">SMGoogle</h2>
          <p className="text-sm text-slate-500">Monitorizare indexare + instructiuni JSON.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs">
            {(['status', 'logs'] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-full transition ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                {tab === 'status' ? 'Status' : 'Loguri'}
              </button>
            ))}
          </div>
          <button type="button" className={buttonGhost} onClick={fetchSmData}>
            Reincarca loguri
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Total loguri</p>
                <p className="text-lg font-semibold text-slate-900">{logs.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Succes</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {logs.filter((l) => l.status === 'success').length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Sarit</p>
                <p className="text-lg font-semibold text-amber-600">
                  {logs.filter((l) => l.status === 'skipped').length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Erori</p>
                <p className="text-lg font-semibold text-red-600">
                  {logs.filter((l) => l.status === 'error').length}
                </p>
              </div>
            </div>

            {links.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600">
                  URL-uri recente (ultimele {Math.min(5, links.length)})
                </h3>
                <div className="mt-3 space-y-2">
                  {links.slice(0, 5).map((link) => (
                    <div
                      key={link.url}
                      className="rounded-xl border border-slate-100 px-4 py-2 text-sm text-slate-600"
                    >
                      <p className="font-medium text-slate-900">{link.url}</p>
                      <p className="text-xs text-slate-400">
                        {link.lastStatus} • {new Date(link.createdAt).toLocaleString('ro-RO')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <form className="space-y-4" onSubmit={submitManualUrl}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <label className={labelStyles} htmlFor="sm-url">
                Trimite manual catre Google
              </label>
              <input
                id="sm-url"
                value={smUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSmUrl(event.target.value)}
                placeholder="https://stire.site/Articol/categorie/slug"
                className={inputStyles}
              />
            </div>
            <button type="submit" className={buttonPrimary} disabled={isSubmitting}>
              {isSubmitting ? 'Trimitem...' : 'Submit manual'}
            </button>
          </div>
        </form>

        {activeTab === 'logs' && links.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600">URL-uri recente</h3>
            <div className="mt-3 space-y-2">
              {links.map((link) => (
                <div
                  key={link.url}
                  className="rounded-xl border border-slate-100 px-4 py-2 text-sm text-slate-600"
                >
                  <p className="font-medium text-slate-900">{link.url}</p>
                  <p className="text-xs text-slate-400">
                    {link.lastStatus} • {new Date(link.createdAt).toLocaleString('ro-RO')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            <h3 className="text-sm font-semibold text-slate-600">Loguri</h3>
            <div className="mt-3 space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{log.url}</span>
                    <span
                      className={`text-xs ${
                        log.status === 'success'
                          ? 'text-emerald-600'
                          : log.status === 'skipped'
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleString('ro-RO')} • {log.source}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{log.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-600">Credentiale JSON</h3>
          {credentials?.source === 'env' && (
            <p className="mt-2 rounded-2xl bg-emerald-50 p-4 text-xs text-emerald-700">
              Credentialele sunt preluate din mediul serverului (.env). Poti suprascrie aceste valori
              salvand JSON-ul mai jos.
            </p>
          )}
          <textarea
            className="mt-3 min-h-[200px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
            placeholder="Pasteaza JSON-ul complet..."
            value={credentialsJson}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setCredentialsJson(event.target.value)
            }
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonPrimary}
              onClick={saveCredentials}
              disabled={isSavingCredentials}
            >
              {isSavingCredentials ? 'Salvam...' : 'Salveaza credentialele'}
            </button>
            {credentials?.source === 'stored' && (
              <button
                type="button"
                className={buttonGhost}
                onClick={deleteCredentials}
                disabled={isSavingCredentials}
              >
                Sterge credentialele
              </button>
            )}
          </div>
          {credentialsMessage && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {credentialsMessage}
            </p>
          )}
        </div>
      </div>

      {message && (
        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      )}
    </div>
  );
};

export default SMGoogleTab;
