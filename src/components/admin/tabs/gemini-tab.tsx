'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GeminiState } from '@/lib/gemini';
import { buttonGhost, buttonPrimary, inputStyles, labelStyles, sectionCard } from '../tab-styles';

const GeminiTab = () => {
  const [state, setState] = useState<GeminiState | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const fetchGemini = useCallback(async () => {
    const response = await fetch('/api/gemini');
    if (!response.ok) throw new Error('Nu am putut incarca starea Gemini.');
    const data = await response.json();
    setState(data.state);
    setInput(data.state?.credentialsJson ?? data.state?.apiKey ?? '');
  }, []);

  useEffect(() => {
    fetchGemini().catch((error) => setMessage(error instanceof Error ? error.message : null));
  }, [fetchGemini]);

  const updateCredentials = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: input }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut salva cheia.');
      setState(payload.state);
      setMessage('Credentialele au fost salvate.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la salvarea cheii.');
    } finally {
      setIsBusy(false);
    }
  };

  const runAction = async (action: 'start' | 'stop' | 'reset') => {
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Actiune esuata.');
      setState(payload.state);
      setMessage(`Actiunea ${action} a fost executata.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la executie.');
    } finally {
      setIsBusy(false);
    }
  };

  const lastRunSummary =
    state && (state.lastRunCreated > 0 || state.lastRunProcessedTopics > 0)
      ? `${state.lastRunCreated} articole din ${state.lastRunProcessedTopics} topicuri`
      : '-';

  return (
    <div className={sectionCard}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Gemini automation</h2>
          <p className="text-sm text-slate-500">Control pane Swift style.</p>
        </div>
        <div className="flex gap-2 text-sm">
          {(['start', 'stop', 'reset'] as const).map((action) => (
            <button
              key={action}
              type="button"
              className={buttonGhost}
              onClick={() => runAction(action)}
              disabled={isBusy}
            >
              {action.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <label className={labelStyles} htmlFor="gemini-key">
            Credentiale Gemini (cheie API sau JSON)
          </label>
          <textarea
            id="gemini-key"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder='AIza... sau {"installed":{...}}'
            rows={6}
            className={`${inputStyles} min-h-[160px] font-mono`}
          />
          <p className="text-xs text-slate-500">
            Acceptam fie o cheie API simpla (<code>AIza...</code>), fie JSON-ul complet generat de
            Google Cloud/AI Studio (structura <code>{'{ "installed": { ... } }'}</code>). Daca furnizezi
            JSON, vom extrage automat <code>client_secret</code> si pastram configuratia pentru referinta.
          </p>
          <button type="button" className={buttonPrimary} onClick={updateCredentials} disabled={isBusy}>
            {isBusy ? 'Salvam...' : 'Salveaza credentialele'}
          </button>
          <div className="grid gap-3 rounded-2xl border border-slate-100 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Credentiale Gemini</span>
              <span className="font-semibold text-slate-900">
                {state?.credentialsJson
                  ? 'JSON configurat'
                  : state?.apiKey
                  ? 'Cheie API setata'
                  : 'Lipsesc'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Articole Gemini create (total)</span>
              <span className="font-semibold text-slate-900">
                {state?.totalArticlesCreated ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Ultima rulare</span>
              <span className="font-semibold text-slate-900">
                {state?.lastRunAt ? new Date(state.lastRunAt).toLocaleString('ro-RO') : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Rezultat ultima rulare</span>
              <span className="font-semibold text-slate-900">{lastRunSummary}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Eroare</span>
              <span className="font-semibold text-red-500">{state?.lastError ?? '-'}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-600">Logs</h3>
          <div className="mt-3 space-y-3">
            {state?.logs?.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-100 px-4 py-2 text-sm">
                <p className="text-slate-900">{log.message}</p>
                <p className="text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleString('ro-RO')} • {log.level}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {message && (
        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      )}
    </div>
  );
};

export default GeminiTab;
