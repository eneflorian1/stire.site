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
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-xs font-medium">
        {[
          { id: 'auto', label: 'AUTO' },
          { id: 'credentials', label: 'Credentials' },
          { id: 'stats', label: 'Statistici' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
            className={`rounded-full px-3 py-1 ${activeSubTab === tab.id
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'auto' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr,1.4fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-xs text-slate-500">
                <p>
                  <span className="font-semibold text-slate-800">Articole:</span>{' '}
                  {state?.lastRunCreated ?? 0}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Ultima rulare:</span>{' '}
                  {lastRunSummary}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Penultima rulare:</span>{' '}
                  {penultimateRunSummary}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Uptime:</span> {uptimeLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
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

            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Surse topicuri:</span>
              <label className="inline-flex items-center gap-2">
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
              <label className="inline-flex items-center gap-2">
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

            {state?.lastError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                <span className="font-semibold">Eroare:</span> {state.lastError}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <h3 className="font-semibold text-slate-800">Log detaliat articole</h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className={buttonGhost}
                  disabled={!selectedLogIds.length}
                  onClick={() => deleteLogs('selected')}
                >
                  Sterge selectate
                </button>
                <button
                  type="button"
                  className={buttonGhost}
                  disabled={!articleLogs.length}
                  onClick={() => deleteLogs('all')}
                >
                  Sterge toate
                </button>
              </div>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 text-xs">
              {articleLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const isSelected = selectedLogIds.includes(log.id);
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex w-full flex-col gap-1 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-left hover:border-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedLogIds((prev) =>
                            checked ? [...prev, log.id] : prev.filter((id) => id !== log.id)
                          );
                        }}
                        className="h-3 w-3 rounded border-slate-300 text-slate-900"
                      />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${log.status === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : log.status === 'skipped'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                          }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-900">
                        {log.articleTitle || log.topicLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
                      <span className="truncate">{log.message}</span>
                      <span>
                        {new Date(log.createdAt).toLocaleString('ro-RO', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>
                    {isExpanded && log.details && (
                      <div className="mt-1 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-600">
                        {log.details}
                      </div>
                    )}
                  </button>
                );
              })}
              {!articleLogs.length && (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  Nu exista loguri pentru articole inca. Ruleaza AUTO pentru a vedea istoricul.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'credentials' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr,1.2fr]">
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
              Google Cloud/AI Studio (structura <code>{'{ "installed": { ... } }'}</code>). Daca
              furnizezi JSON, vom extrage automat <code>client_secret</code> si pastram
              configuratia pentru referinta.
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
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr,1.2fr]">
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
                  Nu exista inca date despre topicuri. Ruleaza AUTO pentru a genera articole.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      )}
    </div>
  );
};

export default GeminiTab;
