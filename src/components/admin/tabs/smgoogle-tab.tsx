'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import type { SubmissionResult } from '@/lib/google-indexing';
import { buttonGhost, buttonPrimary, inputStyles, labelStyles, sectionCard } from '../tab-styles';

type SMGoogleLog = {
  id: string;
  url: string;
  status: 'success' | 'skipped' | 'error';
  detail: string;
  createdAt: string;
  source: 'auto' | 'manual';
  submission?: SubmissionResult;
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

type ViewTab = 'logs' | 'credentials';

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

  const [activeTab, setActiveTab] = useState<ViewTab>('logs');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
      const submission: SubmissionResult | undefined = payload.submission;

      const httpStatus =
        submission && 'status' in submission && typeof submission.status === 'number'
          ? submission.status
          : undefined;

      let baseMessage: string;
      if (submission?.success) {
        baseMessage = 'Link trimis catre Google Indexing.';
      } else if (submission?.skipped) {
        baseMessage = submission.reason ?? 'Trimiterea a fost sarita.';
      } else if (submission) {
        baseMessage = submission.error ?? 'Google a returnat o eroare.';
      } else {
        baseMessage = 'Nu am putut interpreta raspunsul de la Google.';
      }

      // In cazul erorilor, incearca sa afisezi si mesajul brut de la Google (daca exista)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anySubmission = submission as any;
      const googleMessage: string | undefined =
        anySubmission?.googleErrorBody?.message || anySubmission?.googleErrorBody?.error?.message;

      const statusPart = httpStatus ? ` (HTTP ${httpStatus})` : '';
      const googlePart = googleMessage ? ` | Google: ${googleMessage}` : '';

      setMessage(`${baseMessage}${statusPart}${googlePart}`);
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
    <div className="relative min-h-[500px]">
      <div className={sectionCard}>
        <div className="mt-6 space-y-6">
          {activeTab === 'logs' && (
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
                  <PingSitemapsButton />
                </div>
              </form>

              <div>
                <h3 className="text-sm font-semibold text-slate-600">Loguri recente</h3>
                <div className="mt-3 space-y-3">
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const submission = log.submission as SubmissionResult | undefined;

                    const httpStatus =
                      submission && 'status' in submission && typeof submission.status === 'number'
                        ? submission.status
                        : undefined;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const anySubmission = submission as any;
                    const googlePayload =
                      anySubmission?.body ?? anySubmission?.googleErrorBody ?? undefined;

                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900">{log.url}</span>
                          <span
                            className={`text-xs ${log.status === 'success'
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

                        {submission && (
                          <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                            <p>
                              <span className="font-semibold text-slate-700">Status Google API:</span>{' '}
                              {httpStatus ? `HTTP ${httpStatus}` : 'necunoscut'}
                              {submission.skipped ? ' • SKIPPED' : ''}
                            </p>

                            {googlePayload && (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                                  onClick={() =>
                                    setExpandedLogId(isExpanded ? null : log.id)
                                  }
                                >
                                  {isExpanded ? 'Ascunde JSON Google' : 'Vezi JSON brut Google'}
                                </button>
                                {isExpanded && (
                                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-900/90 p-2 text-[10px] text-slate-50">
                                    {JSON.stringify(googlePayload, null, 2)}
                                  </pre>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="space-y-6">
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
          )}
        </div>

        {message && (
          <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-end">
        <button
          type="button"
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-xl hover:bg-slate-800"
          onClick={fetchSmData}
        >
          Reincarca loguri
        </button>

        <div className="w-48 rounded-2xl bg-white p-2 shadow-xl border border-slate-200">
          <div className="flex rounded-full bg-slate-100 p-1">
            {(['logs', 'credentials'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-full py-2 text-xs font-medium transition ${activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {tab === 'logs' ? 'Loguri' : 'Credentials'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};



const PingSitemapsButton = () => {
  const [isPinging, setIsPinging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePing = async () => {
    setIsPinging(true);
    setMessage(null);
    try {
      const response = await fetch('/api/smgoogle/ping');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Eroare la ping.');
      setMessage('Sitemaps pinged successfully!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la ping.');
    } finally {
      setIsPinging(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handlePing}
        disabled={isPinging}
        className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {isPinging ? 'Pinging...' : 'Ping Sitemaps'}
      </button>
      {message && <span className="mt-1 text-xs text-emerald-600">{message}</span>}
    </div>
  );
};

export default SMGoogleTab;
