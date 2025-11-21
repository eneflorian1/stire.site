'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GeminiArticleLog, GeminiState } from '@/lib/gemini';
import {
  buttonGhost,
  buttonPrimary,
  inputStyles,
  labelStyles,
  sectionCard,
} from '../tab-styles';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const GeminiTab = () => {
  const [state, setState] = useState<GeminiState | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'auto' | 'credentials' | 'stats'>('auto');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [serverStartedAt, setServerStartedAt] = useState<string | null>(null);

  const fetchGemini = useCallback(async () => {
    const response = await fetch('/api/gemini');
    if (!response.ok) throw new Error('Nu am putut incarca starea Gemini.');
    const data = await response.json();
    setState(data.state);
    setServerStartedAt(data.serverStartedAt);
    setInput(data.state?.credentialsJson ?? data.state?.apiKey ?? '');
  }, []);

  useEffect(() => {
    fetchGemini().catch((error) => setMessage(error instanceof Error ? error.message : null));
  }, [fetchGemini]);

  // Polling pentru actualizare automata cand ruleaza
  useEffect(() => {
    if (state?.status !== 'running') return;
    const interval = setInterval(() => {
      fetchGemini().catch(() => { }); // ignoram erorile de polling
    }, 3000);
    return () => clearInterval(interval);
  }, [state?.status, fetchGemini]);

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
      if (payload.serverStartedAt) setServerStartedAt(payload.serverStartedAt);
      setMessage('Credentialele au fost salvate.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la salvarea cheii.');
    } finally {
      setIsBusy(false);
    }
  };

  const updateConfig = async (partial: { useManualTopics?: boolean; useTrendTopics?: boolean }) => {
    setIsBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'config', ...partial }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut salva configuratia.');
      setState(payload.state);
      if (payload.serverStartedAt) setServerStartedAt(payload.serverStartedAt);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la salvarea configuratiei.');
    } finally {
      setIsBusy(false);
    }
  };

  const deleteLogs = async (mode: 'selected' | 'all') => {
    if (!state?.articleLogs?.length) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const body =
        mode === 'all'
          ? { action: 'deleteLogs' }
          : { action: 'deleteLogs', ids: selectedLogIds };
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut sterge logurile.');
      setState(payload.state);
      if (payload.serverStartedAt) setServerStartedAt(payload.serverStartedAt);
      setSelectedLogIds([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la stergerea logurilor.');
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
      if (payload.serverStartedAt) setServerStartedAt(payload.serverStartedAt);
      setMessage(`Actiunea ${action} a fost executata.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la executie.');
    } finally {
      setIsBusy(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const lastRunSummary = state?.prevRunAt
    ? `${formatTime(state.prevRunAt)} (${state.prevRunCreated})`
    : '-';

  const penultimateRunSummary = state?.penultimateRunAt
    ? `${formatTime(state.penultimateRunAt)} (${state.penultimateRunCreated})`
    : '-';

  const hasApiKey = Boolean(state?.apiKey);
  const isRunning = state?.status === 'running';

  const uptimeLabel = useMemo(() => {
    if (!state?.startedAt) return '-';
    const started = new Date(state.startedAt).getTime();
    const diffMs = Date.now() - started;
    if (Number.isNaN(diffMs) || diffMs <= 0) return '-';
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}z ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, [state?.startedAt]);

  const articleLogs = (state?.articleLogs ?? []) as GeminiArticleLog[];

  const statsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of articleLogs) {
      if (log.status !== 'success') continue;
      const day = new Date(log.createdAt).toISOString().slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    const entries = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const max = entries.reduce((acc, [, value]) => Math.max(acc, value), 0) || 1;
    return { entries, max };
  }, [articleLogs]);

  return (
    <div className="relative min-h-[600px]">
      <div className={sectionCard}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-medium">
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${isRunning ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
              />
              RUN
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${hasApiKey ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
              />
              API
            </button>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab(activeSubTab === 'credentials' ? 'auto' : 'credentials')}
            className={`rounded-full px-4 py-1 text-xs font-medium transition ${activeSubTab === 'credentials'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            Credentials
          </button>
        </div>

        <div className="mt-6">
          {activeSubTab === 'auto' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="font-semibold text-slate-800">Log detaliat articole</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={buttonGhost}
                    onClick={() =>
                      setSelectedLogIds(
                        selectedLogIds.length === articleLogs.length
                          ? []
                          : articleLogs.map((l) => l.id)
                      )
                    }
                  >
                    {selectedLogIds.length === articleLogs.length ? 'Deselecteaza' : 'Selecteaza tot'}
                  </button>
                  <button
                    type="button"
                    className={buttonGhost}
                    onClick={() => deleteLogs('selected')}
                    disabled={selectedLogIds.length === 0 || isBusy}
                  >
                    Sterge selectate
                  </button>
                  <button
                    type="button"
                    className={buttonGhost}
                    onClick={() => deleteLogs('all')}
                    disabled={articleLogs.length === 0 || isBusy}
                  >
                    Sterge tot
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {articleLogs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Nu exista loguri. Porneste serverul pentru a genera articole.
                  </p>
                ) : (
                  articleLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`group flex flex-col rounded-xl border transition-all ${expandedLogId === log.id
                        ? 'border-slate-300 bg-white shadow-md'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                      <div className="flex items-center gap-3 p-3">
                        {/* 1. Status Badge (Left) */}
                        <div className="shrink-0">
                          {log.status === 'success' && (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              Postat
                            </span>
                          )}
                          {log.status === 'error' && (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-600/20">
                              Eroare
                            </span>
                          )}
                          {log.status === 'skipped' && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              Sarit
                            </span>
                          )}
                        </div>

                        {/* 2. Content (Time, Topic, Title) */}
                        <div className="flex flex-1 items-center gap-3 overflow-hidden">
                          <span className="shrink-0 font-mono text-[10px] text-slate-400">
                            {new Date(log.createdAt).toLocaleTimeString('ro-RO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {log.topicLabel || 'Topic necunoscut'}
                          </span>
                          <span
                            className="truncate text-sm font-medium text-slate-900"
                            title={log.articleTitle || 'Titlu indisponibil'}
                          >
                            {log.articleTitle || (
                              <span className="italic text-slate-400">Fara titlu</span>
                            )}
                          </span>
                        </div>

                        {/* 3. Actions (Details, Checkbox) */}
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLogId(expandedLogId === log.id ? null : log.id)
                            }
                            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${expandedLogId === log.id
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                          >
                            {expandedLogId === log.id ? 'Ascunde' : 'Detalii'}
                          </button>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            checked={selectedLogIds.includes(log.id)}
                            onChange={() =>
                              setSelectedLogIds((prev) =>
                                prev.includes(log.id)
                                  ? prev.filter((id) => id !== log.id)
                                  : [...prev, log.id]
                              )
                            }
                          />
                        </div>
                      </div>

                      {/* 4. Expanded Details (Debug Info) */}
                      {expandedLogId === log.id && (
                        <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-3">
                          <div className="rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-600 shadow-sm">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <span className="font-bold text-slate-400">MSG:</span>
                                <span>{log.message}</span>
                              </div>
                              {log.details && (
                                <div className="flex gap-2">
                                  <span className="font-bold text-slate-400">DBG:</span>
                                  <span className="whitespace-pre-wrap text-slate-500">
                                    {log.details}
                                  </span>
                                </div>
                              )}
                              {log.error && (
                                <div className="flex gap-2 text-rose-600">
                                  <span className="font-bold">ERR:</span>
                                  <span>{log.error}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'credentials' && (
            <div className="grid gap-6 lg:grid-cols-[1.4fr,1.2fr]">
              <div className="space-y-4">
                <label className={labelStyles} htmlFor="gemini-key">
                  Credentiale Gemini (cheie API sau JSON)
                </label>
                <textarea
                  id="gemini-key"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder='AIza... sau {"installed":{...}}'
                  rows={8}
                  className={`${inputStyles} min-h-[200px] font-mono`}
                />
                <p className="text-xs text-slate-500">
                  Acceptam fie o cheie API simpla (<code>AIza...</code>), fie JSON-ul complet generat de
                  Google Cloud/AI Studio.
                </p>
                <button
                  type="button"
                  className={buttonPrimary}
                  onClick={updateCredentials}
                  disabled={isBusy}
                >
                  {isBusy ? 'Salvam...' : 'Salveaza credentialele'}
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100 bg-white">
                    <tr>
                      <td className="px-4 py-3 text-slate-500">Tip credentiale</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {state?.credentialsJson
                          ? 'JSON configurat'
                          : state?.apiKey
                            ? 'Cheie API setata'
                            : 'Lipsesc'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-500">Stare cheie</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasApiKey ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                          />
                          {hasApiKey ? 'Valida' : 'Lipsa'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-500">Articole Gemini create (total)</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {state?.totalArticlesCreated ?? 0}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-500">Server pornit</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {serverStartedAt
                          ? new Date(serverStartedAt).toLocaleString('ro-RO')
                          : '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-500">Eroare recenta</td>
                      <td className="px-4 py-3 font-semibold text-red-500">
                        {state?.lastError ?? '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'stats' && (
            <div className="grid gap-6 lg:grid-cols-[1.4fr,1.2fr]">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Articole pe zile</h3>
                <div className="h-[300px] w-full rounded-2xl border border-slate-100 p-4">
                  {statsByDay.entries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={statsByDay.entries
                          .map(([date, count]) => ({
                            date: new Date(date).toLocaleDateString('ro-RO', {
                              day: '2-digit',
                              month: '2-digit',
                            }),
                            count,
                          }))
                          .reverse()}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                          dx={-10}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#0f172a"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#0f172a', strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: '#0f172a', strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center justify-center text-xs text-slate-400">
                      Nu exista inca suficiente date pentru statistici.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Topicuri utilizate</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  {articleLogs.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">Topic</th>
                          <th className="px-4 py-2 text-right font-medium">Succes/Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Array.from(
                          articleLogs.reduce((map, log) => {
                            const key = log.topicLabel || 'Necunoscut';
                            const current = map.get(key) ?? { total: 0, success: 0 };
                            current.total += 1;
                            if (log.status === 'success') current.success += 1;
                            map.set(key, current);
                            return map;
                          }, new Map<string, { total: number; success: number }>())
                        )
                          .sort((a, b) => (a[1].success < b[1].success ? 1 : -1))
                          .slice(0, 20)
                          .map(([topic, info]) => (
                            <tr key={topic}>
                              <td className="px-4 py-2 text-slate-700">
                                <span className="line-clamp-1">{topic}</span>
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500">
                                {info.success}/{info.total}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-4 text-center text-xs text-slate-400">
                      Nu exista inca date despre topicuri.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {message && (
          <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl bg-white p-4 shadow-xl border border-slate-200 space-y-4">
        <div className="space-y-1 text-xs text-slate-500 border-b border-slate-100 pb-3">
          <p className="flex justify-between">
            <span className="font-semibold text-slate-800">Articole:</span>
            <span>{state?.lastRunCreated ?? 0}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-semibold text-slate-800">Ultima rulare:</span>
            <span>{lastRunSummary}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-semibold text-slate-800">Penultima rulare:</span>
            <span>{penultimateRunSummary}</span>
          </p>
          <p className="flex justify-between">
            <span className="font-semibold text-slate-800">Uptime:</span>
            <span>{uptimeLabel}</span>
          </p>
        </div>

        <div className="flex items-center justify-between text-xs font-medium">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state?.useManualTopics ?? true}
              onChange={(event) =>
                updateConfig({ useManualTopics: event.target.checked })
              }
              className="h-3 w-3 rounded border-slate-300 text-slate-900"
            />
            <span>Manuale</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state?.useTrendTopics ?? true}
              onChange={(event) =>
                updateConfig({ useTrendTopics: event.target.checked })
              }
              className="h-3 w-3 rounded border-slate-300 text-slate-900"
            />
            <span>Trends</span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs font-medium">
          {(['start', 'stop', 'reset'] as const).map((action) => (
            <button
              key={action}
              type="button"
              className={`${buttonGhost} justify-center border border-slate-200`}
              onClick={() => runAction(action)}
              disabled={isBusy}
            >
              {action.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex rounded-full bg-slate-100 p-1">
          {[
            { id: 'auto', label: 'AUTO' },
            { id: 'stats', label: 'Statistici' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as 'auto' | 'stats')}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition ${activeSubTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GeminiTab;
