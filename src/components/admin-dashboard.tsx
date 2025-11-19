'use client';

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Article = {
  id: string;
  title: string;
  summary: string;
  content: string;
  slug: string;
  category: string;
  categorySlug: string;
  status: 'draft' | 'published';
  imageUrl?: string;
  publishedAt: string;
  url: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
};

type Topic = {
  id: string;
  label: string;
  source: 'manual' | 'trend';
  createdAt: string;
};

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

type SMGoogleCredentialsState =
  | { source: 'env'; hasValue: true; updatedAt?: string | null }
  | { source: 'stored'; json: string; updatedAt: string | null }
  | { source: 'missing' };

type GeminiState = {
  apiKey: string | null;
  status: 'idle' | 'running' | 'stopped';
  startedAt: string | null;
  lastError: string | null;
  logs: {
    id: string;
    message: string;
    level: 'info' | 'error';
    createdAt: string;
  }[];
};

type BannerSettings = {
  title: string;
  imageUrl: string;
  animated: boolean;
  notes: string;
  updatedAt: string;
};

type ArticleFormState = {
  title: string;
  summary: string;
  category: string;
  content: string;
  imageUrl: string;
  status: Article['status'];
  publishedAt: string;
};

type CategoryFormState = {
  name: string;
  description: string;
};

type TopicFormState = {
  label: string;
};

type BannerFormState = {
  title: string;
  imageUrl: string;
  animated: boolean;
  notes: string;
};

type Tab =
  | 'articole'
  | 'categorii'
  | 'topicuri'
  | 'smgoogle'
  | 'gemini'
  | 'anunturi';

type TopicTab = 'manual' | 'trends' | 'empty';
type SMTab = 'logs' | 'json';

const GOOGLE_JSON_SAMPLE = `{
  "type": "service_account",
  "project_id": "stire-site",
  "private_key_id": "YOUR_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nYOUR KEY\\n-----END PRIVATE KEY-----\\n",
  "client_email": "service-account@stire-site.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "token_uri": "https://oauth2.googleapis.com/token"
}`;

const tabConfig: { id: Tab; label: string; description: string }[] = [
  { id: 'articole', label: 'Articole', description: 'Publica si gestioneaza stirile.' },
  { id: 'categorii', label: 'Categorii', description: 'Organizeaza temele site-ului.' },
  { id: 'topicuri', label: 'Topicuri', description: 'Manual vs. trenduri Google.' },
  { id: 'smgoogle', label: 'SMGoogle', description: 'Loguri indexare si credentiale.' },
  { id: 'gemini', label: 'Gemini', description: 'Automatizari AI si control.' },
  { id: 'anunturi', label: 'Anunturi', description: 'Banner principal pentru homepage.' },
];

const chipStyles =
  'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600';

const sectionCard =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200';

const labelStyles = 'mb-1 block text-sm font-semibold text-slate-600';
const inputStyles =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

const buttonPrimary =
  'inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60';

const buttonGhost =
  'inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>('articole');
  const [topicTab, setTopicTab] = useState<TopicTab>('manual');
  const [smTab, setSMTab] = useState<SMTab>('logs');

  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [smLogs, setSMLogs] = useState<SMGoogleLog[]>([]);
  const [smLinks, setSMLinks] = useState<SMGoogleLink[]>([]);
  const [geminiState, setGeminiState] = useState<GeminiState | null>(null);
  const [bannerSettings, setBannerSettings] = useState<BannerSettings | null>(null);

  const [articleForm, setArticleForm] = useState<ArticleFormState>({
    title: '',
    summary: '',
    category: '',
    content: '',
    imageUrl: '',
    status: 'published' as Article['status'],
    publishedAt: '',
  });
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({ name: '', description: '' });
  const [topicForm, setTopicForm] = useState<TopicFormState>({ label: '' });
  const [smUrl, setSMUrl] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [bannerForm, setBannerForm] = useState<BannerFormState>({
    title: '',
    imageUrl: '',
    animated: false,
    notes: '',
  });

  const [articleMessage, setArticleMessage] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [topicMessage, setTopicMessage] = useState<string | null>(null);
  const [smMessage, setSMMessage] = useState<string | null>(null);
  const [smCredentials, setSMCredentials] = useState<SMGoogleCredentialsState | null>(null);
  const [smCredentialsJson, setSMCredentialsJson] = useState('');
  const [smCredentialsMessage, setSMCredentialsMessage] = useState<string | null>(null);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [geminiMessage, setGeminiMessage] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const [isSubmittingArticle, setIsSubmittingArticle] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [isImportingTrends, setIsImportingTrends] = useState(false);
  const [isSubmittingSM, setIsSubmittingSM] = useState(false);
  const [isUpdatingGemini, setIsUpdatingGemini] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);

  const fetchArticles = async () => {
    const response = await fetch('/api/articles');
    if (!response.ok) throw new Error('Nu am putut incarca articolele.');
    const data = await response.json();
    setArticles(data.articles ?? []);
  };

  const fetchCategories = async () => {
    const response = await fetch('/api/categories');
    if (!response.ok) throw new Error('Nu am putut incarca categoriile.');
    const data = await response.json();
    setCategories(data.categories ?? []);
  };

  const fetchTopics = async () => {
    const response = await fetch('/api/topics');
    if (!response.ok) throw new Error('Nu am putut incarca topicurile.');
    const data = await response.json();
    setTopics(data.topics ?? []);
  };

  const fetchSMGoogle = async () => {
    const response = await fetch('/api/smgoogle');
    if (!response.ok) throw new Error('Nu am putut incarca logurile Google.');
    const data = await response.json();
    setSMLogs(data.logs ?? []);
    setSMLinks(data.links ?? []);
  };

  const fetchSMCredentials = async () => {
    const response = await fetch('/api/smgoogle/credentials');
    if (!response.ok) throw new Error('Nu am putut incarca credentialele Google.');
    const data = await response.json();
    setSMCredentials(data);
    if (data?.source === 'stored' && typeof data.json === 'string') {
      setSMCredentialsJson(data.json);
    } else {
      setSMCredentialsJson('');
    }
  };

  const fetchGemini = async () => {
    const response = await fetch('/api/gemini');
    if (!response.ok) throw new Error('Nu am putut incarca starea Gemini.');
    const data = await response.json();
    setGeminiState(data.state);
    setGeminiKey(data.state?.apiKey ?? '');
  };

  const fetchBanner = async () => {
    const response = await fetch('/api/banner');
    if (!response.ok) throw new Error('Nu am putut incarca bannerul.');
    const data = await response.json();
    setBannerSettings(data.banner);
    setBannerForm({
      title: data.banner?.title ?? '',
      imageUrl: data.banner?.imageUrl ?? '',
      animated: Boolean(data.banner?.animated),
      notes: data.banner?.notes ?? '',
    });
  };

  useEffect(() => {
    Promise.all([
      fetchArticles(),
      fetchCategories(),
      fetchTopics(),
      fetchSMGoogle(),
      fetchGemini(),
      fetchBanner(),
      fetchSMCredentials(),
    ]).catch((error) => console.error(error));
  }, []);

  const handleArticleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setArticleForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setCategoryForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTopicChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setTopicForm({ label: value });
  };

  const handleBannerChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target;
    const isCheckbox = type === 'checkbox';
    const nextValue =
      isCheckbox && 'checked' in event.target ? (event.target as HTMLInputElement).checked : value;

    setBannerForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const submitArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingArticle(true);
    setArticleMessage(null);
    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(articleForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut crea articolul.');
      }
      setArticles((prev) => [payload.article, ...prev]);
      setArticleForm({
        title: '',
        summary: '',
        category: '',
        content: '',
        imageUrl: '',
        status: 'published',
        publishedAt: '',
      });
      await Promise.all([fetchSMGoogle(), fetchCategories()]);
      setArticleMessage(
        payload.submission?.success
          ? 'Articol publicat si trimis catre Google Indexing.'
          : payload.submission?.skipped
          ? 'Articol publicat, dar trimiterea catre Google a fost sarita.'
          : 'Articol publicat. Verifica logurile Google Indexing.'
      );
    } catch (error) {
      setArticleMessage(
        error instanceof Error ? error.message : 'Eroare la publicarea articolului.'
      );
    } finally {
      setIsSubmittingArticle(false);
    }
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingCategory(true);
    setCategoryMessage(null);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut crea categoria.');
      }
      setCategories((prev) =>
        [...prev.filter((item) => item.id !== payload.category.id), payload.category].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setCategoryForm({ name: '', description: '' });
      setCategoryMessage('Categoria a fost salvata cu succes.');
    } catch (error) {
      setCategoryMessage(
        error instanceof Error ? error.message : 'Eroare la salvarea categoriei.'
      );
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const submitTopic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTopicMessage(null);
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: topicForm.label }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut crea topicul.');
      }
      setTopics((prev) => [payload.topic, ...prev]);
      setTopicForm({ label: '' });
      setTopicMessage('Topic adaugat manual cu succes.');
    } catch (error) {
      setTopicMessage(
        error instanceof Error ? error.message : 'Eroare la salvarea topicului.'
      );
    }
  };

  const importTrends = async () => {
    setIsImportingTrends(true);
    setTopicMessage(null);
    try {
      const response = await fetch('/api/topics/import', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut importa topicurile.');
      }
      await fetchTopics();
      setTopicMessage(
        payload.imported?.length
          ? `S-au importat ${payload.imported.length} topicuri noi.`
          : 'Nu au existat topicuri noi de importat.'
      );
    } catch (error) {
      setTopicMessage(error instanceof Error ? error.message : 'Eroare la import.');
    } finally {
      setIsImportingTrends(false);
    }
  };

  const submitSMGoogle = async () => {
    setIsSubmittingSM(true);
    setSMMessage(null);
    try {
      const response = await fetch('/api/smgoogle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: smUrl }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut trimite URL-ul.');
      }
      await fetchSMGoogle();
      setSMUrl('');
      setSMMessage(
        payload.submission?.success
          ? 'Link trimis cu succes catre Google Indexing.'
          : payload.submission?.skipped
          ? 'Trimiterea a fost sarita.'
          : payload.submission?.error ?? 'Google a returnat o eroare.'
      );
    } catch (error) {
      setSMMessage(error instanceof Error ? error.message : 'Eroare la trimitere.');
    } finally {
      setIsSubmittingSM(false);
    }
  };

  const submitSMCredentials = async () => {
    if (!smCredentialsJson.trim()) {
      setSMCredentialsMessage('Introdu JSON-ul complet al service account-ului.');
      return;
    }

    setIsSavingCredentials(true);
    setSMCredentialsMessage(null);
    try {
      const response = await fetch('/api/smgoogle/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: smCredentialsJson }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut salva credentialele.');
      }
      setSMCredentials(payload);
      setSMCredentialsJson(payload.json ?? '');
      setSMCredentialsMessage('Credentialele au fost salvate.');
    } catch (error) {
      setSMCredentialsMessage(
        error instanceof Error ? error.message : 'Eroare la salvarea credentialelor.'
      );
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const deleteSMCredentials = async () => {
    setIsSavingCredentials(true);
    setSMCredentialsMessage(null);
    try {
      const response = await fetch('/api/smgoogle/credentials', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Nu am putut sterge credentialele.');
      }
      setSMCredentials(payload);
      setSMCredentialsJson('');
      setSMCredentialsMessage('Credentialele au fost sterse.');
    } catch (error) {
      setSMCredentialsMessage(
        error instanceof Error ? error.message : 'Eroare la stergerea credentialelor.'
      );
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const updateGeminiKey = async () => {
    setIsUpdatingGemini(true);
    setGeminiMessage(null);
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut salva cheia.');
      setGeminiState(payload.state);
      setGeminiMessage('Cheia a fost salvata.');
    } catch (error) {
      setGeminiMessage(error instanceof Error ? error.message : 'Eroare la salvarea cheii.');
    } finally {
      setIsUpdatingGemini(false);
    }
  };

  const runGeminiAction = async (action: 'start' | 'stop' | 'reset') => {
    setIsUpdatingGemini(true);
    setGeminiMessage(null);
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Actiune esuata.');
      setGeminiState(payload.state);
      setGeminiMessage(`Actiunea ${action} a fost executata.`);
    } catch (error) {
      setGeminiMessage(error instanceof Error ? error.message : 'Eroare la executie.');
    } finally {
      setIsUpdatingGemini(false);
    }
  };

  const submitBanner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingBanner(true);
    setBannerMessage(null);
    try {
      const response = await fetch('/api/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bannerForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Nu am putut salva bannerul.');
      setBannerSettings(payload.banner);
      setBannerMessage('Bannerul a fost actualizat.');
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : 'Eroare la salvare.');
    } finally {
      setIsSavingBanner(false);
    }
  };

  const manualTopics = useMemo(
    () => topics.filter((topic) => topic.source === 'manual'),
    [topics]
  );
  const trendTopics = useMemo(
    () => topics.filter((topic) => topic.source === 'trend'),
    [topics]
  );

  const geminiUptime = useMemo(() => {
    if (!geminiState?.startedAt || geminiState.status !== 'running') return '-';
    const diff = Date.now() - new Date(geminiState.startedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }, [geminiState]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'articole':
        return (
          <ArticlesTab
            articles={articles}
            form={articleForm}
            onChange={handleArticleChange}
            onSubmit={submitArticle}
            onRefresh={fetchArticles}
            message={articleMessage}
            isSubmitting={isSubmittingArticle}
          />
        );
      case 'categorii':
        return (
          <CategoriesTab
            categories={categories}
            form={categoryForm}
            onChange={handleCategoryChange}
            onSubmit={submitCategory}
            message={categoryMessage}
            isSubmitting={isSubmittingCategory}
          />
        );
      case 'topicuri':
        return (
          <TopicsTab
            activeTab={topicTab}
            onTabChange={setTopicTab}
            manualTopics={manualTopics}
            trendTopics={trendTopics}
            form={topicForm}
            onChange={handleTopicChange}
            onSubmit={submitTopic}
            onImport={importTrends}
            message={topicMessage}
            isImporting={isImportingTrends}
          />
        );
      case 'smgoogle':
        return (
          <SMGoogleTab
            activeTab={smTab}
            onTabChange={setSMTab}
            smUrl={smUrl}
            onUrlChange={setSMUrl}
            onSubmit={submitSMGoogle}
            links={smLinks}
            logs={smLogs}
            message={smMessage}
            isSubmitting={isSubmittingSM}
            credentials={smCredentials}
            credentialsJson={smCredentialsJson}
            onCredentialsJsonChange={setSMCredentialsJson}
            onSaveCredentials={submitSMCredentials}
            onDeleteCredentials={deleteSMCredentials}
            credentialsMessage={smCredentialsMessage}
            isSavingCredentials={isSavingCredentials}
          />
        );
      case 'gemini':
        return (
          <GeminiTab
            state={geminiState}
            geminiKey={geminiKey}
            onKeyChange={setGeminiKey}
            onSaveKey={updateGeminiKey}
            onAction={runGeminiAction}
            message={geminiMessage}
            isBusy={isUpdatingGemini}
            articlesCount={articles.length}
            uptime={geminiUptime}
          />
        );
      case 'anunturi':
        return (
          <AnunturiTab
            form={bannerForm}
            onChange={handleBannerChange}
            onSubmit={submitBanner}
            isSaving={isSavingBanner}
            message={bannerMessage}
            lastUpdated={bannerSettings?.updatedAt}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section id="admin-dashboard" className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">stire.site</p>
            <h1 className="text-3xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">
              Interfata Swift alba, responsive si gata pentru redactia de stiri.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <span className={chipStyles}>Articole {articles.length}</span>
            <span className={chipStyles}>Categorii {categories.length}</span>
            <span className={chipStyles}>Topicuri {topics.length}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                activeTab === tab.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold">{tab.label}</p>
              <p className="text-xs opacity-80">{tab.description}</p>
            </button>
          ))}
        </div>
      </div>

      {renderTabContent()}
    </section>
  );
};

export default AdminDashboard;

type ArticlesTabProps = {
  articles: Article[];
  form: ArticleFormState;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  message: string | null;
  isSubmitting: boolean;
};

const ArticlesTab = ({
  articles,
  form,
  onChange,
  onSubmit,
  onRefresh,
  message,
  isSubmitting,
}: ArticlesTabProps) => (
  <div className="grid gap-8 lg:grid-cols-[1.2fr,1fr]">
    <form onSubmit={onSubmit} className={sectionCard} id="admin-create-article">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Creeaza articol</h2>
          <p className="text-sm text-slate-500">Swift form, actualizari instant.</p>
        </div>
        <button type="submit" className={buttonPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Publicam...' : 'Publica articolul'}
        </button>
      </div>
      <div className="mt-6 grid gap-4">
        <div>
          <label className={labelStyles} htmlFor="title">
            Titlu
          </label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={onChange}
            required
            className={inputStyles}
            placeholder="Banca Mondiala a anuntat noi reglementari"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelStyles} htmlFor="category">
              Categorie
            </label>
            <input
              id="category"
              name="category"
              value={form.category}
              onChange={onChange}
              required
              className={inputStyles}
              placeholder="economic, politic..."
            />
          </div>
          <div>
            <label className={labelStyles} htmlFor="imageUrl">
              URL imagine / GIF
            </label>
            <input
              id="imageUrl"
              name="imageUrl"
              value={form.imageUrl}
              onChange={onChange}
              className={inputStyles}
              placeholder="https://cdn.stire.site/img.jpg"
            />
          </div>
        </div>
        <div>
          <label className={labelStyles} htmlFor="summary">
            Descriere scurta
          </label>
          <textarea
            id="summary"
            name="summary"
            value={form.summary}
            onChange={onChange}
            required
            rows={3}
            className={inputStyles}
            placeholder="Context pentru listari si sitemap."
          />
        </div>
        <div>
          <label className={labelStyles} htmlFor="content">
            Continut
          </label>
          <textarea
            id="content"
            name="content"
            value={form.content}
            onChange={onChange}
            required
            rows={8}
            className={inputStyles}
            placeholder="Text complet al stirii."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelStyles} htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={onChange}
              className={inputStyles}
            >
              <option value="published">Publicat</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelStyles} htmlFor="publishedAt">
              Data publicarii
            </label>
            <input
              type="datetime-local"
              id="publishedAt"
              name="publishedAt"
              value={form.publishedAt}
              onChange={onChange}
              className={inputStyles}
            />
          </div>
        </div>
      </div>
      {message && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      )}
    </form>
    <div className={sectionCard}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Articole recente</h2>
        <button type="button" className={buttonGhost} onClick={onRefresh}>
          Reincarca
        </button>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500">
        <span className={chipStyles}>
          Publicate: {articles.filter((a) => a.status === 'published').length}
        </span>
        <span className={chipStyles}>
          Drafturi: {articles.filter((a) => a.status === 'draft').length}
        </span>
        <span className={chipStyles}>
          Categorii: {new Set(articles.map((a) => a.categorySlug)).size}
        </span>
      </div>
      <ul className="mt-6 space-y-4">
        {articles.slice(0, 6).map((article) => (
          <li key={article.id} className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-slate-400">{article.category}</p>
                <p className="text-base font-semibold text-slate-900">{article.title}</p>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(article.publishedAt).toLocaleDateString('ro-RO')}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{article.summary}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className={chipStyles}>{article.status}</span>
              <span className="font-mono text-slate-500">{article.slug}</span>
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-500 hover:text-sky-600"
              >
                Vezi live &gt;
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

type CategoriesTabProps = {
  categories: Category[];
  form: CategoryFormState;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  message: string | null;
  isSubmitting: boolean;
};

const CategoriesTab = ({
  categories,
  form,
  onChange,
  onSubmit,
  message,
  isSubmitting,
}: CategoriesTabProps) => (
  <div className="grid gap-8 lg:grid-cols-[1fr,1fr]">
    <form onSubmit={onSubmit} className={sectionCard}>
      <h2 className="text-lg font-semibold text-slate-900">Adauga categorie</h2>
      <p className="text-sm text-slate-500">
        Fiecare articol nou poate sincroniza automat categoria.
      </p>
      <div className="mt-6 space-y-4">
        <div>
          <label className={labelStyles} htmlFor="category-name">
            Nume categorie
          </label>
          <input
            id="category-name"
            name="name"
            value={form.name}
            onChange={onChange}
            className={inputStyles}
            placeholder="Tech, Economic, Lifestyle..."
            required
          />
        </div>
        <div>
          <label className={labelStyles} htmlFor="category-description">
            Descriere
          </label>
          <textarea
            id="category-description"
            name="description"
            value={form.description}
            onChange={onChange}
            className={inputStyles}
            rows={3}
            placeholder="Optional – folosit intern."
          />
        </div>
        <button type="submit" className={buttonPrimary} disabled={isSubmitting}>
          {isSubmitting ? 'Salvam...' : 'Salveaza categoria'}
        </button>
      </div>
      {message && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      )}
    </form>
    <div className={sectionCard}>
      <h2 className="text-lg font-semibold text-slate-900">Categorii existente</h2>
      <ul className="mt-4 space-y-3">
        {categories.map((category) => (
          <li
            key={category.id}
            className="rounded-xl border border-slate-100 p-3 text-sm text-slate-600"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{category.name}</span>
              <span className="text-xs text-slate-400">{category.slug}</span>
            </div>
            {category.description && (
              <p className="mt-1 text-xs text-slate-500">{category.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

type TopicsTabProps = {
  activeTab: TopicTab;
  onTabChange: (tab: TopicTab) => void;
  manualTopics: Topic[];
  trendTopics: Topic[];
  form: TopicFormState;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onImport: () => void;
  message: string | null;
  isImporting: boolean;
};

const TopicsTab = ({
  activeTab,
  onTabChange,
  manualTopics,
  trendTopics,
  form,
  onChange,
  onSubmit,
  onImport,
  message,
  isImporting,
}: TopicsTabProps) => (
  <div className={sectionCard}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Topicuri editoriale</h2>
        <p className="text-sm text-slate-500">Manual, Trends, Gol.</p>
      </div>
      <div className="flex gap-2">
        {(['manual', 'trends', 'empty'] as TopicTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={
              tab === activeTab ? `${buttonPrimary} !bg-sky-600` : `${buttonGhost} text-sm`
            }
          >
            {tab === 'manual' && 'Manual'}
            {tab === 'trends' && 'Trends'}
            {tab === 'empty' && 'Gol'}
          </button>
        ))}
      </div>
    </div>

    {activeTab === 'manual' && (
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr,1fr]">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelStyles} htmlFor="topic-label">
              Topic manual
            </label>
            <input
              id="topic-label"
              value={form.label}
              onChange={onChange}
              className={inputStyles}
              placeholder="Introdu un subiect manual"
              required
            />
          </div>
          <button type="submit" className={buttonPrimary}>
            Adauga topic
          </button>
        </form>
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
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Importa cele mai noi cautari Google Trends pentru Romania.
          </p>
          <button
            type="button"
            onClick={onImport}
            className={buttonPrimary}
            disabled={isImporting}
          >
            {isImporting ? 'Importam...' : 'Importa topicuri'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {trendTopics.map((topic) => (
            <div
              key={topic.id}
              className="rounded-xl border border-slate-100 px-4 py-3 text-sm text-slate-600"
            >
              <p className="font-medium text-slate-900">{topic.label}</p>
              <p className="text-xs text-slate-400">
                {new Date(topic.createdAt).toLocaleString('ro-RO')}
              </p>
            </div>
          ))}
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
);

type SMGoogleTabProps = {
  activeTab: SMTab;
  onTabChange: (tab: SMTab) => void;
  smUrl: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  links: SMGoogleLink[];
  logs: SMGoogleLog[];
  message: string | null;
  isSubmitting: boolean;
  credentials: SMGoogleCredentialsState | null;
  credentialsJson: string;
  onCredentialsJsonChange: (value: string) => void;
  onSaveCredentials: () => Promise<void>;
  onDeleteCredentials: () => Promise<void>;
  credentialsMessage: string | null;
  isSavingCredentials: boolean;
};

const SMGoogleTab = ({
  activeTab,
  onTabChange,
  smUrl,
  onUrlChange,
  onSubmit,
  links,
  logs,
  message,
  isSubmitting,
  credentials,
  credentialsJson,
  onCredentialsJsonChange,
  onSaveCredentials,
  onDeleteCredentials,
  credentialsMessage,
  isSavingCredentials,
}: SMGoogleTabProps) => (
  <div className={sectionCard}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">SMGoogle</h2>
        <p className="text-sm text-slate-500">Monitorizare indexare + instructiuni JSON.</p>
      </div>
      <div className="flex gap-2">
        {(['logs', 'json'] as SMTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={tab === activeTab ? buttonPrimary : buttonGhost}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>
    </div>

    {activeTab === 'logs' && (
      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <label className={labelStyles} htmlFor="sm-url">
              Trimite manual catre Google
            </label>
            <input
              id="sm-url"
              value={smUrl}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="https://stire.site/Articol/categorie/slug"
              className={inputStyles}
            />
          </div>
          <button type="button" onClick={onSubmit} className={buttonPrimary} disabled={isSubmitting}>
            {isSubmitting ? 'Trimitem...' : 'Submit manual'}
          </button>
        </div>
        {links.length > 0 && (
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
      </div>
    )}

    {activeTab === 'json' && (
      <div className="mt-6 space-y-4">
        {credentials?.source === 'env' ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            Credentialele sunt preluate din mediul serverului (.env) si nu pot fi modificate din
            dashboard. Actualizeaza secretul `GOOGLE_APPLICATION_CREDENTIALS_JSON` pentru a schimba
            acest comportament.
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Introdu structura JSON a service account-ului direct din dashboard. Datele sunt
              criptate local in fisierul <code>data/smgoogle-account.json</code> si folosite doar
              pentru Google Indexing API.
            </p>
            <textarea
              className="min-h-[200px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
              placeholder="Pasteaza JSON-ul complet..."
              value={credentialsJson}
              onChange={(event) => onCredentialsJsonChange(event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={buttonPrimary}
                onClick={onSaveCredentials}
                disabled={isSavingCredentials}
              >
                {isSavingCredentials ? 'Salvam...' : 'Salveaza credentialele'}
              </button>
              {credentials?.source === 'stored' && (
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={onDeleteCredentials}
                  disabled={isSavingCredentials}
                >
                  Sterge credentialele
                </button>
              )}
            </div>
            {credentials?.updatedAt && (
              <p className="text-xs text-slate-400">
                Ultima actualizare: {new Date(credentials.updatedAt).toLocaleString('ro-RO')}
              </p>
            )}
          </>
        )}
        <p className="text-xs text-slate-500">
          Daca preferi varianta clasica, poti seta variabila{' '}
          <code className="rounded bg-slate-100 px-2 py-1 text-xs">
            GOOGLE_APPLICATION_CREDENTIALS_JSON
          </code>{' '}
          in .env și dashboard-ul va deveni read-only.
        </p>
        <pre className="rounded-2xl bg-slate-900 p-4 text-xs text-white">{GOOGLE_JSON_SAMPLE}</pre>
        {credentialsMessage && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{credentialsMessage}</p>
        )}
      </div>
    )}

    {message && (
      <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
    )}
  </div>
);

type GeminiTabProps = {
  state: GeminiState | null;
  geminiKey: string;
  onKeyChange: (value: string) => void;
  onSaveKey: () => Promise<void>;
  onAction: (action: 'start' | 'stop' | 'reset') => Promise<void>;
  message: string | null;
  isBusy: boolean;
  articlesCount: number;
  uptime: string;
};

const GeminiTab = ({
  state,
  geminiKey,
  onKeyChange,
  onSaveKey,
  onAction,
  message,
  isBusy,
  articlesCount,
  uptime,
}: GeminiTabProps) => (
  <div className={sectionCard}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Gemini automation</h2>
        <p className="text-sm text-slate-500">Control pane Swift style.</p>
      </div>
      <div className="flex gap-2 text-xl">
        <button
          type="button"
          className={buttonGhost}
          onClick={() => onAction('start')}
          aria-label="Start"
        >
          ▶️ Start
        </button>
        <button
          type="button"
          className={buttonGhost}
          onClick={() => onAction('stop')}
          aria-label="Stop"
        >
          ⏹️ Stop
        </button>
        <button
          type="button"
          className={buttonGhost}
          onClick={() => onAction('reset')}
          aria-label="Reset"
        >
          🔄 Reset
        </button>
      </div>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-4">
        <label className={labelStyles} htmlFor="gemini-key">
          Cheie API Gemini
        </label>
        <input
          id="gemini-key"
          value={geminiKey}
          onChange={(event) => onKeyChange(event.target.value)}
          placeholder="AIza..."
          className={inputStyles}
        />
        <button type="button" className={buttonPrimary} onClick={onSaveKey} disabled={isBusy}>
          {isBusy ? 'Salvam...' : 'Salveaza cheia'}
        </button>
        <div className="grid gap-3 rounded-2xl border border-slate-100 p-4 text-sm">
          <DataRow label="Cheie Gemini" value={state?.apiKey ? '✅ setata' : '❌ lipseste'} />
          <DataRow label="Articole create" value={String(articlesCount)} />
          <DataRow
            label="Pornit la"
            value={
              state?.startedAt ? new Date(state.startedAt).toLocaleString('ro-RO') : '-'
            }
          />
          <DataRow label="Uptime" value={uptime} />
          <DataRow label="Eroare" value={state?.lastError ?? '-'} highlight />
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

const DataRow = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="flex items-center justify-between">
    <span>{label}</span>
    <span className={`font-semibold ${highlight ? 'text-red-500' : ''}`}>{value}</span>
  </div>
);

type AnunturiTabProps = {
  form: BannerFormState;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  message: string | null;
  lastUpdated?: string;
};

const AnunturiTab = ({
  form,
  onChange,
  onSubmit,
  isSaving,
  message,
  lastUpdated,
}: AnunturiTabProps) => (
  <form onSubmit={onSubmit} className={sectionCard}>
    <h2 className="text-lg font-semibold text-slate-900">Gestionare anunturi</h2>
    <p className="text-sm text-slate-500">
      Bannerul principal afisat pe homepage in zona de reclama.
    </p>
    <div className="mt-6 space-y-4">
      <div>
        <label className={labelStyles} htmlFor="banner-title">
          Titlu banner
        </label>
        <input
          id="banner-title"
          name="title"
          value={form.title}
          onChange={onChange}
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
          onChange={onChange}
          className={inputStyles}
          required
          placeholder="https://..."
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="banner-animated"
          name="animated"
          checked={form.animated}
          onChange={onChange}
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
          onChange={onChange}
          className={inputStyles}
          rows={4}
          placeholder="Accepta JPG/PNG/GIF. Bannerul de pe desktop este afisat sub stirea principala..."
        />
      </div>
      <button type="submit" className={buttonPrimary} disabled={isSaving}>
        {isSaving ? 'Publicam...' : 'Publica banner'}
      </button>
      {lastUpdated && (
        <p className="text-xs text-slate-400">
          Ultima actualizare: {new Date(lastUpdated).toLocaleString('ro-RO')}
        </p>
      )}
    </div>
    {message && (
      <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
    )}
  </form>
);
