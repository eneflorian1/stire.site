'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import type { Topic } from '@/lib/topics';
import { buttonGhost, buttonPrimary, inputStyles, labelStyles, sectionCard } from '../tab-styles';

type TopicTab = 'manual' | 'trends' | 'empty';

const TopicsTab = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState({ label: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TopicTab>('manual');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTrendIds, setSelectedTrendIds] = useState<string[]>([]);

  const fetchTopics = useCallback(async () => {
    const response = await fetch('/api/topics');
    if (!response.ok) throw new Error('Nu am putut incarca topicurile.');
    const data = await response.json();
    setTopics(data.topics ?? []);
  }, []);

  useEffect(() => {
    fetchTopics().catch((error) => setMessage(error instanceof Error ? error.message : null));
  }, [fetchTopics]);

  const manualTopics = useMemo(() => topics.filter((topic) => topic.source === 'manual'), [topics]);
  const trendTopics = useMemo(() => topics.filter((topic) => topic.source === 'trend'), [topics]);

  const submitTopic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut crea topicul.');
      setTopics((prev) => [payload.topic, ...prev]);
      setForm({ label: '' });
      setMessage('Topic adaugat manual cu succes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la salvarea topicului.');
    }
  };

  const toggleTrendSelection = (id: string) => {
    setSelectedTrendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const deleteSelectedTrends = async () => {
    if (selectedTrendIds.length === 0) {
      setMessage('Selecteaza cel putin un topic pentru stergere.');
      return;
    }
    setIsImporting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedTrendIds }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut sterge topicurile.');
      }
      setTopics(payload.topics ?? []);
      setSelectedTrendIds([]);
      setMessage(`Au fost sterse ${payload.deleted ?? 0} topicuri.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la stergerea topicurilor.');
    } finally {
      setIsImporting(false);
    }
  };

  const importTrends = async () => {
    setIsImporting(true);
    setMessage(null);
    try {
      // Use CORS proxy to bypass Google's CORS restrictions
      const RSS_URL = 'https://trends.google.com/trending/rss?geo=RO';
      const PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`;

      const rssResponse = await fetch(PROXY_URL, {
        cache: 'no-store',
      });

      if (!rssResponse.ok) {
        throw new Error('Nu am putut accesa Google Trends RSS.');
      }

      const rssText = await rssResponse.text();

      // Parse RSS to extract titles
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(rssText, 'text/xml');
      const items = xmlDoc.querySelectorAll('item title');

      const titles: string[] = [];
      items.forEach((item) => {
        const title = item.textContent?.trim();
        if (title) {
          titles.push(title);
        }
      });

      if (titles.length === 0) {
        throw new Error('Nu am găsit topicuri în RSS feed.');
      }

      // Send titles to server to save
      const response = await fetch('/api/topics/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut importa topicurile.');

      await fetchTopics();
      setMessage(
        payload.imported?.length
          ? `S-au importat ${payload.imported.length} topicuri noi.`
          : 'Nu au existat topicuri noi de importat.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la import.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="relative min-h-[500px]">
      <div className={sectionCard}>
        {activeTab === 'manual' && (
          <div className="mt-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-600">
                Topicuri manuale ({manualTopics.length})
              </h3>
              <div className="mt-3 space-y-2">
                {manualTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="rounded-xl border border-slate-100 px-4 py-2 text-sm text-slate-600"
                  >
                    {topic.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-slate-600">
                Importa cele mai noi cautari Google Trends pentru Romania.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={() => setSelectedTrendIds(trendTopics.map((t) => t.id))}
                  disabled={trendTopics.length === 0}
                >
                  Selecteaza toate
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedTrends}
                  className={buttonGhost}
                  disabled={isImporting || selectedTrendIds.length === 0}
                >
                  Sterge selectate
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {trendTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-2 text-sm text-slate-600"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{topic.label}</p>
                      <span className="text-xs text-slate-400">
                        {new Date(topic.createdAt).toLocaleString('ro-RO')}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      checked={selectedTrendIds.includes(topic.id)}
                      onChange={() => toggleTrendSelection(topic.id)}
                    />
                  </div>
                </div>
              ))}
              {trendTopics.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                  Nu exista topicuri importate inca.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'empty' && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Gol – foloseste taburile Manual sau Trends pentru a popula lista.
          </div>
        )}

        {message && (
          <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-end">
        {activeTab === 'manual' && (
          <div className="w-80 rounded-2xl bg-white p-4 shadow-xl border border-slate-200">
            <form onSubmit={submitTopic}>
              <h2 className="text-base font-bold text-slate-900 mb-3">Topic Manual</h2>
              <div className="space-y-3">
                <div>
                  <input
                    id="topic-label"
                    value={form.label}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setForm({ label: event.target.value })
                    }
                    className="w-full rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:ring-0"
                    placeholder="Introdu un subiect manual"
                    required
                  />
                </div>
                <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  Adauga topic
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'trends' && (
          <button
            type="button"
            onClick={importTrends}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-xl hover:bg-slate-800 disabled:opacity-50"
            disabled={isImporting}
          >
            {isImporting ? 'Importam...' : 'Importa topicuri'}
          </button>
        )}

        <div className="w-64 rounded-2xl bg-white p-2 shadow-xl border border-slate-200">
          <div className="flex rounded-full bg-slate-100 p-1">
            {(['manual', 'trends', 'empty'] as TopicTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-full py-2 text-xs font-medium transition ${activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {tab === 'manual' && 'Manual'}
                {tab === 'trends' && 'Trends'}
                {tab === 'empty' && 'Gol'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicsTab;
