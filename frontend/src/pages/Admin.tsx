import { useEffect, useMemo, useState } from 'react';
import {
  createCategory,
  deleteArticle,
  deleteCategory,
  fetchArticles,
  fetchCategories,
  fetchCategoriesRaw,
  fetchTopics,
  fetchTopicStatuses,
  createTopic,
  updateTopic,
  deleteTopic,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getGeminiKey,
  setGeminiKey,
  getAutoposterStatus,
  getAutoposterLogs,
  autoposterStart,
  autoposterStop,
  autoposterReset,
  type Article,
  type Category,
} from '../api';
import type { Topic, TopicStatus, Announcement, AutoposterStatus, AutoposterLog } from '../types';

export default function Admin() {
  const tabs = ['Articole', 'Categorii', 'Topicuri', 'Anunțuri', 'Gemini'] as const;
  type Tab = typeof tabs[number];
  const [tab, setTab] = useState<Tab>('Articole');
  return (
    <div className="admin-page">
      <div className="container" style={{ maxWidth: 1100 }}>
        <div className="tabs" style={{ justifyContent: 'flex-start' }}>
          {tabs.map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {tab === 'Articole' && <ArticlesAdmin />}
        {tab === 'Categorii' && <CategoriesAdmin />}
        {tab === 'Topicuri' && <TopicsAdmin />}
        {tab === 'Anunțuri' && <AnnouncementsAdmin />}
        {tab === 'Gemini' && <GeminiAdmin />}
      </div>
    </div>
  );
}

function ArticlesAdmin() {
  const [categories, setCategories] = useState<string[]>(['Toate']);
  const [current, setCurrent] = useState<string>('Toate');
  const [q, setQ] = useState<string>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCategories().then((cats) => {
      if (Array.isArray(cats) && cats.length) setCategories(cats);
    }).catch(() => void 0);
  }, []);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const list = await fetchArticles({ category: current, q, limit: 100 });
      setArticles(list);
    } finally {
      setLoading(false);
    }
  }, [current, q]);

  useEffect(() => { void load(); }, [load]);

  async function onDelete(id: string) {
    if (!confirm('Ștergi articolul?')) return;
    try {
      await deleteArticle(id);
      await load();
    } catch (e) {
      alert(String(e));
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <input className="input" placeholder="Caută titlu sau rezumat…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void load(); }} />
        <select className="select" value={current} onChange={(e) => setCurrent(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn secondary" onClick={() => void load()}>Aplică</button>
      </div>
      {loading ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {articles.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--admin-border)' }}>
              <img src={a.image_url} alt="article" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="chip">{a.category}</span>
                  <div className="title" style={{ margin: 0 }}>{a.title}</div>
                </div>
                <div className="summary line-2" style={{ marginTop: 4 }}>{a.summary}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn secondary" onClick={() => window.open(`/create`, '_self')}>Editează</button>
                <button className="btn danger" onClick={() => void onDelete(a.id)}>Șterge</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriesAdmin() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const list = await fetchCategoriesRaw();
      setCats(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addCat() {
    const name = prompt('Nume categorie:');
    if (!name) return;
    await createCategory(name.trim());
    await load();
  }

  async function editCat(c: Category) {
    const name = prompt('Editează numele categoriei:', c.name);
    if (!name) return;
    // reuse update via createCategory? Implemented separate update
    await import('../api').then(({ updateCategory }) => updateCategory(c.id, name.trim()));
    await load();
  }

  async function deleteCat(c: Category) {
    if (!confirm(`Ștergi "${c.name}"?`)) return;
    await deleteCategory(c.id);
    await load();
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => void addCat()}>Adaugă categorie</button>
      </div>
      {loading ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {cats.map((c) => (
            <div key={c.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="chip">{c.name}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn secondary" onClick={() => void editCat(c)}>Editează</button>
                <button className="btn danger" onClick={() => void deleteCat(c)}>Șterge</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicsAdmin() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TopicStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [ts, st] = await Promise.all([fetchTopics(), fetchTopicStatuses()]);
      setTopics(ts);
      const map: Record<string, TopicStatus> = {};
      st.forEach((s) => { map[s.topic_id] = s; });
      setStatuses(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addTopic() {
    const name = prompt('Nume topic:');
    if (!name) return;
    const description = prompt('Descriere (opțional):') || undefined;
    await createTopic(name.trim(), description?.trim());
    await load();
  }

  async function editTopic(t: Topic) {
    const name = prompt('Editează numele topicului:', t.name) ?? t.name;
    const description = prompt('Editează descrierea:', t.description ?? '') ?? t.description ?? '';
    await updateTopic(t.id, name.trim(), description.trim());
    await load();
  }

  async function delTopic(t: Topic) {
    if (!confirm(`Ștergi "${t.name}"?`)) return;
    await deleteTopic(t.id);
    await load();
  }

  function ledColor(s?: TopicStatus): string {
    if (!s) return '#22c55e'; // green
    const now = Date.now();
    const updated = s.updated_at ? Date.parse(s.updated_at) : 0;
    const recent = updated && (now - updated) < 24 * 3600 * 1000;
    if (s.last_result === 'error' && recent) return '#ef4444'; // red
    if (s.last_posted_at && recent) return '#3b82f6'; // blue
    return '#22c55e';
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => void addTopic()}>Adaugă topic</button>
      </div>
      {loading ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <div className="grid">
          {topics.map((t) => (
            <div key={t.id} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: ledColor(statuses[t.id]) }} />
                  <strong>{t.name}</strong>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn secondary" onClick={() => void editTopic(t)}>Editează</button>
                  <button className="btn danger" onClick={() => void delTopic(t)}>Șterge</button>
                </div>
              </div>
              {t.description && <div className="muted" style={{ marginTop: 6 }}>{t.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementsAdmin() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([fetchAnnouncements(), fetchTopics()]);
      setItems(a);
      setTopics(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addAnn() {
    const title = prompt('Titlu:');
    if (!title) return;
    const content = prompt('Conținut:') ?? '';
    const topic = prompt('Topic (opțional, nume exact):') || null;
    await createAnnouncement(title.trim(), content.trim(), topic && topic.length ? topic : null);
    await load();
  }

  async function editAnn(a: Announcement) {
    const title = prompt('Editează titlul:', a.title) ?? a.title;
    const content = prompt('Editează conținutul:', a.content) ?? a.content;
    const topic = prompt('Editează topic (gol pentru fără):', a.topic ?? '') ?? a.topic ?? '';
    await updateAnnouncement(a.id, title.trim(), content.trim(), topic.length ? topic : null);
    await load();
  }

  async function delAnn(a: Announcement) {
    if (!confirm(`Ștergi "${a.title}"?`)) return;
    await deleteAnnouncement(a.id);
    await load();
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => void addAnn()}>Adaugă anunț</button>
      </div>
      {loading ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((a) => (
            <div key={a.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ maxWidth: '70%' }}>
                <div className="title">{a.title}</div>
                {a.topic && <span className="chip" style={{ marginRight: 8 }}>{a.topic}</span>}
                <div className="summary" style={{ marginTop: 6 }}>{a.content}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn secondary" onClick={() => void editAnn(a)}>Editează</button>
                <button className="btn danger" onClick={() => void delAnn(a)}>Șterge</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeminiAdmin() {
  const [apiKey, setApiKey] = useState<string>('');
  const [status, setStatus] = useState<AutoposterStatus | null>(null);
  const [logs, setLogs] = useState<AutoposterLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);

  const reload = useMemo(() => async () => {
    setLoading(true);
    try {
      const [k, st, lg] = await Promise.all([getGeminiKey(), getAutoposterStatus(), getAutoposterLogs()]);
      setApiKey(k);
      setStatus(st);
      setRunning(Boolean(st.running));
      setLogs(lg.slice(-50).reverse());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function saveKey() {
    await setGeminiKey(apiKey.trim());
    alert('Cheia Gemini a fost salvată');
  }

  async function onStart() {
    const st = await autoposterStart();
    setStatus(st);
    setRunning(true);
  }
  async function onStop() {
    const st = await autoposterStop();
    setStatus(st);
    setRunning(false);
  }
  async function onReset() {
    const st = await autoposterReset();
    setStatus(st);
    await reload();
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      {loading ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input className="input" type="password" placeholder="Gemini API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <button className="btn" onClick={() => void saveKey()}>Salvează</button>
            </div>
            <div style={{ marginTop: 8 }} className="muted">Cheia este stocată în baza de date.</div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn" onClick={() => void onStart()} disabled={running}>Start</button>
              <button className="btn secondary" onClick={() => void onStop()} disabled={!running}>Stop</button>
              <button className="btn secondary" onClick={() => void onReset()}>Reset</button>
            </div>
            {status && (
              <div style={{ marginTop: 8 }} className="muted">
                Status: {running ? 'Pornit' : 'Oprit'}{status.items_created != null ? ` • Articole create: ${status.items_created}` : ''}{status.current_topic ? ` • Topic: ${status.current_topic}` : ''}
                {status.last_error ? <div style={{ color: '#ef4444' }}>Eroare: {status.last_error}</div> : null}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div className="title">Jurnale recente</div>
            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
              {logs.length === 0 ? (
                <div className="muted">Fără evenimente</div>
              ) : (
                logs.map((e, i) => (
                  <div key={i} className="muted" style={{ fontSize: 12, padding: '2px 0' }}>
                    [{e.level.toUpperCase()}] {e.ts} – {e.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

