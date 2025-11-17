import { useEffect, useMemo, useState, Fragment, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  uploadGoogleServiceAccount,
  getAutoposterStatus,
  getAutoposterLogs,
  autoposterStart,
  autoposterStop,
  autoposterReset,
  setAdminApiKey,
  updateCategory,
  importTrends,
  type Article,
  type Category,
} from '../api';
import type { Topic, TopicStatus, Announcement, AutoposterStatus, AutoposterLog } from '../types';

export default function Admin() {
  const tabs = ['Articole', 'Categorii', 'Topicuri', 'Anunțuri', 'Gemini'] as const;
  type Tab = typeof tabs[number];
  const [tab, setTab] = useState<Tab>('Articole');
  const [w, setW] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    let disposed = false;
    getGeminiKey()
      .then((k) => {
        if (!disposed && k && k.trim().length > 0) setAdminApiKey(k);
      })
      .catch(() => {
        // do not clear persisted admin key on error
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="admin-page">
      <div className="container" style={{ maxWidth: 1240 }}>
        <div className="tabs" style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
          {tabs.filter((t) => t !== 'Anunțuri').map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            className={`tab is-muted ${tab === 'Anunțuri' ? 'active' : ''}`}
            onClick={() => setTab('Anunțuri')}
          >
            Anunțuri
          </button>
        </div>
        {tab === 'Articole' && <ArticlesAdmin />}
        {tab === 'Categorii' && <CategoriesAdmin />}
        {tab === 'Topicuri' && <TopicsAdmin />}
        {tab === 'Anunțuri' && <AnnouncementsAdmin />}
        {tab === 'Gemini' && <GeminiAdmin />}
      </div>
      {tab === 'Categorii' && w >= 992 ? (
        <button
          className="btn"
          onClick={() => window.dispatchEvent(new CustomEvent('admin:add-category'))}
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50 }}
        >
          Adaugă categorie
        </button>
      ) : null}
      {tab === 'Topicuri' && w >= 992 ? (
        <button
          className="btn"
          onClick={() => window.dispatchEvent(new CustomEvent('admin:add-topic'))}
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50 }}
        >
          Adaugă topic
        </button>
      ) : null}
    </div>
  );
}

function ArticlesAdmin() {
  const nav = useNavigate();
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
      // Elimină din listă local fără refresh
      setArticles(prev => prev.filter(a => a.id !== id));
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
                
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn secondary" onClick={() => nav('/create')}>Editează</button>
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
  const [w, setW] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

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

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handler = () => { void addCat(); };
    window.addEventListener('admin:add-category', handler as EventListener);
    return () => window.removeEventListener('admin:add-category', handler as EventListener);
  }, []);

  async function addCat() {
    const name = prompt('Nume categorie:');
    if (!name) return;
    try {
      const newCat = await createCategory(name.trim());
      // Adaugă la listă local fără refresh
      setCats(prev => [...prev, newCat]);
    } catch (e) {
      alert(`Nu am putut crea categoria: ${String(e)}`);
    }
  }

  async function editCat(c: Category) {
    const name = prompt('Editează numele categoriei:', c.name);
    if (!name) return;
    try {
      const updated = await updateCategory(c.id, name.trim());
      // Actualizează în listă local fără refresh
      setCats(prev => prev.map(cat => cat.id === c.id ? updated : cat));
    } catch (e) {
      alert(`Nu am putut edita categoria: ${String(e)}`);
    }
  }

  async function deleteCat(c: Category) {
    if (!confirm(`Ștergi "${c.name}"?`)) return;
    try {
      await deleteCategory(c.id);
      // Elimină din listă local fără refresh
      setCats(prev => prev.filter(cat => cat.id !== c.id));
    } catch (e) {
      alert(`Nu am putut șterge categoria: ${String(e)}`);
    }
  }

  return (
    <div className="card" style={{ padding: 12, position: 'relative' }}>
      {w < 992 ? (
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn" onClick={() => void addCat()}>Adaugă categorie</button>
        </div>
      ) : null}
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
  const [bulkText, setBulkText] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [w, setW] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [subTab, setSubTab] = useState<'Manual' | 'Trends' | 'Gol'>('Manual');

  const load = useMemo(() => async () => {
    setLoading(true);
    try {
      const [ts, st] = await Promise.all([fetchTopics(), fetchTopicStatuses()]);
      setTopics(ts);
      // curăță selecții inexistente după reload
      setSelectedIds((prev) => new Set(ts.map((t) => t.id).filter((id) => prev.has(id))));
      const map: Record<string, TopicStatus> = {};
      st.forEach((s) => { map[s.topic_id] = s; });
      setStatuses(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handler = () => { void addTopic(); };
    window.addEventListener('admin:add-topic', handler as EventListener);
    return () => window.removeEventListener('admin:add-topic', handler as EventListener);
  }, []);

  const manualTopics = topics.filter((t) => !t.imported_from || t.imported_from !== 'google_trends');
  const trendsTopics = topics.filter((t) => t.imported_from === 'google_trends');
  const currentTopics = subTab === 'Manual' ? manualTopics : subTab === 'Trends' ? trendsTopics : [];

  async function addTopic() {
    const name = prompt('Nume topic:');
    if (!name) return;
    
    try {
      const newTopic = await createTopic(name.trim());
      // Adaugă la listă local fără refresh
      setTopics(prev => [...prev, newTopic]);
    } catch (e) {
      alert(`Nu am putut crea topicul: ${String(e)}`);
    }
  }

  async function importTopics() {
    const text = bulkText.trim();
    if (!text) return;
    // Înlocuiește separatori comuni (newline, tab, virgulă, punct și virgulă) cu newline
    const normalized = text
      .replace(/[\t,;]+/g, '\n')
      .replace(/\s*\n+\s*/g, '\n');
    const names = Array.from(new Set(
      normalized
        .split('\n')
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length > 0)
    ));
    if (names.length === 0) return;
    setImporting(true);
    try {
      // Creează topicurile în paralel cu un număr rezonabil
      const newTopics = await Promise.all(names.map((n) => createTopic(n)));
      // Adaugă la listă local fără refresh
      setTopics(prev => [...prev, ...newTopics]);
      setBulkText('');
    } catch (e) {
      alert(`Nu am putut importa unele topicuri: ${String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  async function importGoogleTrends() {
    if (!confirm('Import trenduri Google? Se vor șterge trendurile vechi și se vor adăuga cele noi.')) return;
    setImporting(true);
    try {
      const result = await importTrends('RO');
      alert(`Import finalizat: ${result.inserted} topicuri noi, ${result.deleted} șterse.`);
      await load();
    } catch (e) {
      alert(`Nu am putut importa trenduri: ${String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === currentTopics.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentTopics.map((t) => t.id)));
    }
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteTopic(id)));
      // Elimină din listă local fără refresh
      setTopics(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } catch (e) {
      alert(`Nu am putut șterge unele topicuri: ${String(e)}`);
    }
  }

  async function editTopic(t: Topic) {
    const name = prompt('Editează numele topicului:', t.name) ?? t.name;
    try {
      const updated = await updateTopic(t.id, name.trim());
      // Actualizează în listă local fără refresh
      setTopics(prev => prev.map(topic => topic.id === t.id ? updated : topic));
    } catch (e) {
      alert(`Nu am putut edita topicul: ${String(e)}`);
    }
  }

  async function delTopic(t: Topic) {
    if (!confirm(`Ștergi "${t.name}"?`)) return;
    try {
      await deleteTopic(t.id);
      // Elimină din listă local fără refresh
      setTopics(prev => prev.filter(topic => topic.id !== t.id));
    } catch (e) {
      alert(`Nu am putut șterge topicul: ${String(e)}`);
    }
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

  function formatExpiresAt(expiresAt: string | null | undefined): string {
    if (!expiresAt) return '-';
    try {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) return expiresAt;
      return d.toLocaleString('ro-RO', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return expiresAt;
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      {/* Sub-tab-uri */}
      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--admin-border)', paddingBottom: 8 }}>
        <button 
          className={`tab ${subTab === 'Manual' ? 'active' : ''}`} 
          onClick={() => setSubTab('Manual')}
        >
          Manual
        </button>
        <button 
          className={`tab ${subTab === 'Trends' ? 'active' : ''}`} 
          onClick={() => setSubTab('Trends')}
        >
          Trends
        </button>
        <button 
          className={`tab ${subTab === 'Gol' ? 'active' : ''}`} 
          onClick={() => setSubTab('Gol')}
        >
          Gol
        </button>
      </div>

      {subTab === 'Manual' && (
        <>
          <div className="row" style={{ marginBottom: 12, gap: 8, alignItems: 'stretch' }}>
            {w < 992 ? (<button className="btn" onClick={() => void addTopic()}>Adaugă topic</button>) : null}
          </div>
          {loading ? (
            <div className="muted">Se încarcă...</div>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
                <button className="btn danger" onClick={() => void deleteSelected()} disabled={selectedIds.size === 0}>Șterge selectate</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--admin-surface-high)', color: 'var(--admin-text)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 14px' }}>Nume</th>
                      <th style={{ textAlign: 'left', padding: '12px 14px', width: 180 }}>Editare</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', width: 180 }}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                            <span>Selectează toate</span>
                            <input type="checkbox" checked={selectedIds.size === currentTopics.length && currentTopics.length > 0} onChange={() => toggleAll()} />
                          </label>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTopics.map((t) => (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--admin-border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, background: ledColor(statuses[t.id]) }} />
                            <strong>{t.name}</strong>
                          </div>
                          {t.description && <div className="muted" style={{ marginTop: 4 }}>{t.description}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <button className="btn secondary" onClick={() => void editTopic(t)}>Editează</button>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleOne(t.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div className="title" style={{ marginBottom: 8 }}>Import topicuri (lipire din clipboard)</div>
            <textarea
              className="input"
              placeholder="Lipește aici topicurile (separate prin Enter, Tab sau ,)"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              style={{ width: '100%', minHeight: 100, resize: 'vertical' }}
            />
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => void importTopics()} disabled={importing || !bulkText.trim()}>Importă topicuri</button>
              <button className="btn secondary" onClick={() => setBulkText('')} disabled={importing || !bulkText}>Curăță</button>
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Acceptă separatori: Enter, Tab, virgulă, punct și virgulă. Duplicatele sunt ignorate.
            </div>
          </div>
        </>
      )}

      {subTab === 'Trends' && (
        <>
          <div className="row" style={{ marginBottom: 12, gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="muted">Topicuri importate din Google Trends (expiră după 24h)</div>
            <button className="btn" onClick={() => void importGoogleTrends()} disabled={importing}>
              {importing ? 'Importă...' : 'Importă trenduri'}
            </button>
          </div>
          {loading ? (
            <div className="muted">Se încarcă...</div>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
                <button className="btn danger" onClick={() => void deleteSelected()} disabled={selectedIds.size === 0}>Șterge selectate</button>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--admin-surface-high)', color: 'var(--admin-text)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 14px' }}>Nume</th>
                      <th style={{ textAlign: 'left', padding: '12px 14px', width: 200 }}>Expiră la</th>
                      <th style={{ textAlign: 'left', padding: '12px 14px', width: 180 }}>Editare</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', width: 180 }}>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                            <span>Selectează toate</span>
                            <input type="checkbox" checked={selectedIds.size === currentTopics.length && currentTopics.length > 0} onChange={() => toggleAll()} />
                          </label>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTopics.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                          Nu există topicuri importate din Google Trends. Apasă "Importă trenduri" pentru a importa.
                        </td>
                      </tr>
                    ) : (
                      currentTopics.map((t) => (
                        <tr key={t.id} style={{ borderTop: '1px solid var(--admin-border)' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: ledColor(statuses[t.id]) }} />
                              <strong>{t.name}</strong>
                            </div>
                            {t.description && <div className="muted" style={{ marginTop: 4 }}>{t.description}</div>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span className="muted">{formatExpiresAt(t.expires_at)}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <button className="btn secondary" onClick={() => void editTopic(t)}>Editează</button>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleOne(t.id)} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {subTab === 'Gol' && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          Acest tab va fi completat ulterior.
        </div>
      )}
    </div>
  );
}

function AnnouncementsAdmin() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newUrl, setNewUrl] = useState<string>('');
  const [useAnimatedBanner, setUseAnimatedBanner] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const itemsPerPage = 20;

  const load = useMemo(() => async (page: number = 1) => {
    if (page === 1) {
      setLoading(true);
    }
    try {
      const offset = (page - 1) * itemsPerPage;
      const [a, t] = await Promise.all([
        fetchAnnouncements({ offset, limit: itemsPerPage }),
        page === 1 ? fetchTopics() : Promise.resolve(null)
      ]);
      if (page === 1) {
        setItems(a);
        if (t) setTopics(t);
      } else {
        setItems(prev => [...prev, ...a]);
      }
      setHasMore(a.length === itemsPerPage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  async function addAnn() {
    const title = prompt('Titlu:');
    if (!title) return;
    const content = prompt('Conținut:') ?? '';
    const topic = prompt('Topic (opțional, nume exact):') || null;
    try {
      const newAnn = await createAnnouncement(title.trim(), content.trim(), topic && topic.length ? topic : null);
      // Adaugă la începutul listei fără refresh
      setItems(prev => [newAnn, ...prev]);
    } catch (e) {
      alert(`Nu am putut crea anunțul: ${String(e)}`);
    }
  }

  async function editAnn(a: Announcement) {
    const title = prompt('Editează titlul:', a.title) ?? a.title;
    const content = prompt('Editează conținutul:', a.content) ?? a.content;
    const topic = prompt('Editează topic (gol pentru fără):', a.topic ?? '') ?? a.topic ?? '';
    const currentValue = a.use_animated_banner ?? false;
    const useAnimated = confirm(`Folosește banner animat? (${currentValue ? 'Curent: DA' : 'Curent: NU'})\nApasă OK pentru DA, Anulează pentru NU`) ? true : false;
    try {
      const updated = await updateAnnouncement(a.id, title.trim(), content.trim(), topic.length ? topic : null, useAnimated);
      // Actualizează în listă local fără refresh
      setItems(prev => prev.map(item => item.id === a.id ? updated : item));
    } catch (e) {
      alert(`Nu am putut edita anunțul: ${String(e)}`);
    }
  }

  async function delAnn(a: Announcement) {
    try {
      await deleteAnnouncement(a.id);
      // Elimină din listă local fără refresh
      setItems(prev => prev.filter(item => item.id !== a.id));
    } catch (e) {
      alert(`Nu am putut șterge anunțul: ${String(e)}`);
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="title" style={{ marginBottom: 8 }}>Banner reclamă (imagine/GIF cu link către de-vanzare.ro)</div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder="Titlu banner" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <input className="input" placeholder="URL imagine sau GIF (https://...)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <button
            className="btn"
            onClick={async () => {
              const t = newTitle.trim();
              const u = newUrl.trim();
              if (!t) { alert('Completează titlul bannerului.'); return; }
              if (!useAnimatedBanner && !u) { alert('Completează URL-ul imaginii sau bifează opțiunea pentru banner animat.'); return; }
              try {
                const newAnn = await createAnnouncement(t, u || '', null, useAnimatedBanner);
                setNewTitle('');
                setNewUrl('');
                setUseAnimatedBanner(false);
                // Adaugă la începutul listei fără refresh
                setItems(prev => [newAnn, ...prev]);
              } catch (e) {
                alert(String(e));
              }
            }}
          >Publică banner</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
          <label className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={useAnimatedBanner} 
              onChange={(e) => setUseAnimatedBanner(e.target.checked)} 
            />
            <span>Folosește banner animat (în loc de imagine)</span>
          </label>
        </div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Acceptă JPG/PNG/GIF. Bannerul de pe desktop este afișat sub știrea principală, cu link către de-vanzare.ro. Dacă bifezi opțiunea, se va afișa bannerul animat în locul imaginii.</div>
      </div>
      {loading && items.length === 0 ? (
        <div className="muted">Se încarcă...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((a) => (
              <div key={a.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ maxWidth: '70%' }}>
                  <div className="title">{a.title}</div>
                  {a.topic && <span className="chip" style={{ marginRight: 8 }}>{a.topic}</span>}
                  {a.use_animated_banner && <span className="chip" style={{ marginRight: 8, background: 'rgba(100, 102, 241, 0.15)', color: '#6466f1' }}>Banner animat</span>}
                  <div className="summary" style={{ marginTop: 6 }}>{a.content}</div>
                  {a.content && (a.content.startsWith('http://') || a.content.startsWith('https://')) && !a.use_animated_banner ? (
                    <div style={{ marginTop: 8 }}>
                      <img src={a.content} alt={a.title} style={{ maxWidth: 360, maxHeight: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--admin-border)' }} />
                    </div>
                  ) : null}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn secondary" onClick={() => void editAnn(a)}>Editează</button>
                  <button className="btn danger" onClick={() => void delAnn(a)}>Șterge</button>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                className="btn secondary"
                onClick={() => {
                  const nextPage = currentPage + 1;
                  setCurrentPage(nextPage);
                  void load(nextPage);
                }}
                disabled={loading}
              >
                {loading ? 'Se încarcă...' : 'Încarcă mai multe'}
              </button>
            </div>
          )}
        </>
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
  
  // FIX: Folosim useRef pentru a urmări statusul curent fără re-render
  const runningRef = useRef<boolean>(false);
  const pollingRef = useRef<number | null>(null);

  // FIX: Funcție de polling lightweight pentru status în timp real
  const pollStatus = useCallback(async () => {
    try {
      const [st, lg] = await Promise.all([getAutoposterStatus(), getAutoposterLogs(500)]);
      setStatus(st);
      const isRunning = Boolean(st.running);
      setRunning(isRunning);
      runningRef.current = isRunning;
      setLogs(lg);
    } catch (e) {
      console.error('Error polling status:', e);
    }
  }, []);

  // FIX: Pornește polling automat când componenta este mounted
  useEffect(() => {
    const startPolling = () => {
      // Oprește polling-ul existent dacă există
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      
      // Pornește polling la fiecare 2 secunde
      pollingRef.current = setInterval(() => {
        void pollStatus();
      }, 2000);
    };

    startPolling();

    // Cleanup la unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollStatus]);

  const reload = useMemo(() => async () => {
    setLoading(true);
    try {
      const [k, st, lg] = await Promise.all([getGeminiKey(), getAutoposterStatus(), getAutoposterLogs(500)]);
      const normalizedKey = k && k.trim().length > 0 ? k : '';
      setApiKey(normalizedKey);
      if (normalizedKey) setAdminApiKey(normalizedKey); else setAdminApiKey(undefined);
      setStatus(st);
      const isRunning = Boolean(st.running);
      setRunning(isRunning);
      runningRef.current = isRunning;
      setLogs(lg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  function formatTimestamp(ts?: string | null): string {
    if (!ts) return '-';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatUptime(startedAt?: string | null): string {
    if (!startedAt) return '-';
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const ms = Math.max(0, now - start);
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  }

  async function saveKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      alert('Introdu o cheie Gemini validă.');
      return;
    }
    try {
      await setGeminiKey(trimmed);
      setAdminApiKey(trimmed);
      setApiKey(trimmed);
      // Nu mai afișăm alert, doar actualizăm local
      // alert('Cheia Gemini a fost salvată');
    } catch (error) {
      console.error('Nu am putut salva cheia Gemini', error);
      alert('Nu am putut salva cheia Gemini. Verifică cheia și încearcă din nou.');
    }
  }

  async function handleUploadGoogleServiceAccount(file: File) {
    try {
      await uploadGoogleServiceAccount(file);
      alert('Fișierul Google Service Account a fost încărcat cu succes!');
    } catch (e) {
      alert(`Eroare la încărcare: ${String(e)}`);
    }
  }

  // FIX: Funcție optimizată pentru Start cu feedback vizual imediat
  async function onStart() {
    try {
      // Update optimistic
      setRunning(true);
      runningRef.current = true;
      
      await autoposterStart();
      
      // Poll imediat după start
      await pollStatus();
    } catch (e) {
      alert(`Nu am putut porni autoposterul: ${String(e)}`);
      // Revert la starea reală
      await pollStatus();
    }
  }

  // FIX: Funcție optimizată pentru Stop cu verificare graduală
  async function onStop() {
    try {
      // Update optimistic - feedback vizual imediat
      setRunning(false);
      runningRef.current = false;
      
      // Trimite comanda de stop
      await autoposterStop();
      
      // FIX: Polling smart - verifică statusul la intervale crescânde
      const checkStop = async (attempt: number = 0, maxAttempts: number = 10): Promise<void> => {
        if (attempt >= maxAttempts) {
          // Dacă nu s-a oprit după 10 încercări, forțează refresh final
          await pollStatus();
          return;
        }
        
        // Așteaptă cu delay crescând: 300ms, 500ms, 800ms, 1200ms, ...
        const delay = Math.min(300 * Math.pow(1.5, attempt), 3000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Verifică statusul
        const st = await getAutoposterStatus();
        
        if (!st.running) {
          // S-a oprit cu succes
          setStatus(st);
          setRunning(false);
          runningRef.current = false;
          
          // Refresh final pentru logs
          const lg = await getAutoposterLogs(500);
          setLogs(lg);
          return;
        }
        
        // Încă rulează, încercă din nou
        return checkStop(attempt + 1, maxAttempts);
      };
      
      await checkStop();
      
    } catch (e) {
      alert(`Nu am putut opri autoposterul: ${String(e)}`);
      // Revert la starea reală
      await pollStatus();
    }
  }

  async function onReset() {
    try {
      const st = await autoposterReset();
      setStatus(st);
      const isRunning = Boolean(st.running);
      setRunning(isRunning);
      runningRef.current = isRunning;
      
      // Refresh logs imediat
      await pollStatus();
    } catch (e) {
      alert(`Nu am putut reseta autoposterul: ${String(e)}`);
      await pollStatus();
    }
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
            <div style={{ marginBottom: 8 }}>
              <strong>Google Service Account JSON</strong>
            </div>
            <div style={{ marginBottom: 8 }} className="muted">
              Încarcă fișierul JSON cu credențialele Google Service Account pentru Google Indexing API.
            </div>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUploadGoogleServiceAccount(file);
                }
              }}
              style={{ marginBottom: 8 }}
            />
            <div className="muted">Fișierul este stocat în baza de date.</div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            {/* FIX: Indicatori vizuali îmbunătățiți pentru status */}
            <div className="row" style={{ gap: 8, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: running ? '#22c55e' : '#ef4444',
                boxShadow: running ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
                animation: running ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ fontWeight: 600, color: running ? '#22c55e' : '#ef4444' }}>
                {running ? 'PORNIT' : 'OPRIT'}
              </span>
            </div>
            
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button 
                className="btn" 
                onClick={() => void onStart()} 
                disabled={running}
                style={{
                  opacity: running ? 0.5 : 1,
                  cursor: running ? 'not-allowed' : 'pointer'
                }}
              >
                ▶️ Start
              </button>
              <button 
                className="btn secondary" 
                onClick={() => void onStop()} 
                disabled={!running}
                style={{
                  opacity: !running ? 0.5 : 1,
                  cursor: !running ? 'not-allowed' : 'pointer'
                }}
              >
                ⏹️ Stop
              </button>
              <button 
                className="btn secondary" 
                onClick={() => void onReset()}
              >
                🔄 Reset
              </button>
            </div>
            
            {status && (
              <div style={{ 
                marginTop: 16, 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                columnGap: 16, 
                rowGap: 8,
                padding: 12,
                background: 'var(--admin-surface-high)',
                borderRadius: 8
              }} className="muted">
                <div><strong>Cheie Gemini</strong></div>
                <div>{apiKey ? '✅ setată' : '❌ lipsește'}</div>
                
                <div><strong>Articole create</strong></div>
                <div>{status.items_created ?? 0}</div>
                
                {status.current_topic ? (
                  <>
                    <div><strong>Topic curent</strong></div>
                    <div style={{ fontWeight: 600, color: '#3b82f6' }}>{status.current_topic}</div>
                  </>
                ) : null}
                
                <div><strong>Pornit la</strong></div>
                <div>{formatTimestamp(status.started_at ?? null)}</div>
                
                <div><strong>Uptime</strong></div>
                <div>{formatUptime(status.started_at ?? null)}</div>
                
                {logs.length > 0 ? (
                  <>
                    <div><strong>Ultimul eveniment</strong></div>
                    <div>{formatTimestamp(logs[0]?.ts)}</div>
                  </>
                ) : null}
                
                {status.last_error ? (
                  <>
                    <div><strong>Eroare</strong></div>
                    <div style={{ color: '#ef4444', fontWeight: 600 }}>{status.last_error}</div>
                  </>
                ) : null}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="title">Jurnale recente</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Total: {logs.length} evenimente | 
                <span style={{ marginLeft: 8 }}>
                  {running ? '🔄 Actualizare automată' : '⏸️ Pausat'}
                </span>
              </div>
            </div>
            <LogTree logs={logs} formatTimestamp={formatTimestamp} />
          </div>
        </>
      )}
      
      {/* FIX: CSS pentru animația pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

type TreeNode = {
  key: string;
  label: string;
  status: 'ok' | 'skip' | 'fail' | 'pending' | 'info';
  entries: AutoposterLog[];
};

function LogTree({ logs, formatTimestamp }: { logs: AutoposterLog[]; formatTimestamp: (ts?: string | null) => string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const nodes: TreeNode[] = useMemo(() => {
    const topicMap = new Map<string, TreeNode>();
    const systemKey = '__system__';
    const ensure = (k: string, label: string) => {
      const ex = topicMap.get(k);
      if (ex) return ex;
      const n: TreeNode = { key: k, label, status: 'info', entries: [] };
      topicMap.set(k, n);
      return n;
    };

    const getTopicFromMessage = (m: string): string | null => {
      const match = m.match(/'([^']+)'/);
      return match ? match[1] : null;
    };

    for (const e of logs) {
      const topic = getTopicFromMessage(e.message) || systemKey;
      const label = topic === systemKey ? 'Sistem' : topic;
      const node = ensure(topic, label);
      node.entries.push(e);
    }

    for (const node of topicMap.values()) {
      const msgs = node.entries.map((e) => e.message);
      const hasOk = msgs.some((m) => m.startsWith('✅'));
      const hasSkip = msgs.some((m) => m.startsWith('⏭️'));
      const hasFail = msgs.some((m) => m.startsWith('❌') || m.includes('conținut gol'));
      if (node.key === systemKey) {
        node.status = 'info';
      } else if (hasOk) {
        node.status = 'ok';
      } else if (hasFail) {
        node.status = 'fail';
      } else if (hasSkip) {
        node.status = 'skip';
      } else {
        node.status = 'pending';
      }
    }

    const arr = Array.from(topicMap.values());
    // Order: non-system by recency of first entry, system last
    arr.sort((a, b) => {
      if (a.key === systemKey && b.key !== systemKey) return 1;
      if (b.key === systemKey && a.key !== systemKey) return -1;
      const ta = a.entries[0]?.ts ? new Date(a.entries[0].ts).getTime() : 0;
      const tb = b.entries[0]?.ts ? new Date(b.entries[0].ts).getTime() : 0;
      return tb - ta;
    });
    return arr;
  }, [logs]);

  const statusChip = (s: TreeNode['status']) => {
    const map: Record<TreeNode['status'], { text: string; bg: string; fg: string }> = {
      ok: { text: 'POSTAT', bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981' },
      skip: { text: 'SKIP', bg: 'rgba(234, 179, 8, 0.15)', fg: '#eab308' },
      fail: { text: 'EȘUAT', bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
      pending: { text: 'ÎN CURS', bg: 'rgba(59, 130, 246, 0.15)', fg: '#3b82f6' },
      info: { text: 'INFO', bg: 'rgba(148, 163, 184, 0.15)', fg: '#64748b' },
    };
    const cfg = map[s];
    return (
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        letterSpacing: 0.3,
        display: 'inline-block',
        minWidth: 56,
        textAlign: 'center',
      }}>{cfg.text}</span>
    );
  };

  return (
    <div style={{ height: 480, overflow: 'auto', marginTop: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', whiteSpace: 'pre-wrap' }}>
      {logs.length === 0 ? (
        <div className="muted">Fără evenimente</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nodes.map((n) => {
            const isOpen = Boolean(expanded[n.key]);
            const toggle = () => setExpanded((s) => ({ ...s, [n.key]: !s[n.key] }));
            return (
              <div key={n.key} style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  onClick={toggle}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', background: 'var(--admin-bg)' }}
                >
                  {statusChip(n.status)}
                  <span className="muted" style={{ fontSize: 12 }}>{isOpen ? '▼' : '▶'}</span>
                  <div style={{ fontWeight: 600 }}>{n.label}</div>
                  <div style={{ flex: 1 }} />
                  <div className="muted" style={{ fontSize: 12 }}>{n.entries.length} evenimente</div>
                </div>
                {isOpen ? (
                  <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '180px 1fr', columnGap: 12 }}>
                    {n.entries.map((e, idx) => (
                      <Fragment key={`${e.ts}-${idx}`}>
                        <div className="muted" style={{ fontSize: 12, padding: '2px 0' }}>{formatTimestamp(e.ts)}</div>
                        <div className="muted" style={{ fontSize: 12, padding: '2px 0' }}>{e.message}</div>
                      </Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

