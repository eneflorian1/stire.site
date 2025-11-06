import type { Article, ArticleDetail, Category, Topic, TopicStatus, Announcement, AutoposterStatus, AutoposterLog } from './types';
export type { Article, ArticleDetail, Category, Topic, TopicStatus, Announcement, AutoposterStatus, AutoposterLog } from './types';

// Use same-origin base path by default (no explicit port). In dev, Vite proxies /api -> backend.
const API_BASE_PATH: string = (import.meta.env.VITE_API_BASE_PATH as string) || '/api';
const DEFAULT_ADMIN_API_KEY = import.meta.env.VITE_API_KEY || 'devkey';

let adminApiKey = DEFAULT_ADMIN_API_KEY;

export function setAdminApiKey(key?: string | null, _options: { persist?: boolean } = {}): void {
  const trimmed = key?.trim() ?? '';
  adminApiKey = trimmed.length > 0 ? trimmed : DEFAULT_ADMIN_API_KEY;
}

function getAdminApiKey(): string | undefined {
  const trimmed = adminApiKey?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getPersistedAdminApiKey(): string | undefined {
  // Browser persistence removed; no persisted value available anymore
  return undefined;
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : '') + API_BASE_PATH.replace(/\/$/, '');
  const url = new URL(base + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function httpGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = buildUrl(path, params);
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) throw new Error(`GET ${url} failed: ${resp.status}`);
  return resp.json();
}

async function httpPost<T>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path);
  const apiKey = getAdminApiKey();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`POST ${url} failed: ${resp.status} ${txt}`);
  }
  return resp.json();
}

async function httpPut<T>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path);
  const apiKey = getAdminApiKey();
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`PUT ${url} failed: ${resp.status} ${txt}`);
  }
  return resp.json();
}

async function httpDelete(path: string): Promise<void> {
  const url = buildUrl(path);
  const apiKey = getAdminApiKey();
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: apiKey ? { 'x-api-key': apiKey } : {},
  });
  if (!resp.ok && resp.status !== 204) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`DELETE ${url} failed: ${resp.status} ${txt}`);
  }
}

export async function fetchCategories(): Promise<string[]> {
  return httpGet<string[]>('/categories');
}

export async function fetchArticles(args: { category?: string; q?: string; offset?: number; limit?: number } = {}): Promise<Article[]> {
  const { category, q, offset = 0, limit = 20 } = args;
  return httpGet<Article[]>('/articles', {
    category: category && category !== 'Toate' ? category : undefined,
    q: q && q.trim().length > 0 ? q : undefined,
    offset,
    limit,
  });
}

export async function fetchArticle(id: string): Promise<Article> {
  return httpGet<Article>(`/articles/${id}`);
}

export async function fetchArticleDetail(idOrSlug: string): Promise<ArticleDetail> {
  return httpGet<ArticleDetail>(`/articles/seo/${idOrSlug}`);
}

export async function createArticle(payload: Omit<Article, 'id' | 'published_at'> & { published_at?: string }): Promise<Article> {
  const body = {
    title: payload.title,
    summary: payload.summary,
    image_url: payload.image_url,
    source: payload.source,
    category: payload.category,
    published_at: payload.published_at,
  };
  return httpPost<Article>('/articles', body);
}

// Admin endpoints
export async function deleteArticle(id: string): Promise<void> {
  return httpDelete(`/articles/${id}`);
}

export async function updateArticle(id: string, payload: Partial<Omit<Article, 'id'>>): Promise<Article> {
  const body: Record<string, unknown> = { ...payload };
  return httpPut<Article>(`/articles/${id}`, body);
}

export async function fetchCategoriesRaw(): Promise<Category[]> {
  return httpGet<Category[]>('/categories/raw');
}

export async function createCategory(name: string): Promise<Category> {
  return httpPost<Category>('/categories', { name });
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  return httpPut<Category>(`/categories/${id}`, { name });
}

export async function deleteCategory(id: string): Promise<void> {
  return httpDelete(`/categories/${id}`);
}

// Topics
export async function fetchTopics(): Promise<Topic[]> {
  return httpGet<Topic[]>('/topics');
}

export async function fetchTopicStatuses(): Promise<TopicStatus[]> {
  return httpGet<TopicStatus[]>('/topics/statuses');
}

export async function createTopic(name: string, description?: string): Promise<Topic> {
  return httpPost<Topic>('/topics', { name, description });
}

export async function updateTopic(id: string, name: string, description?: string): Promise<Topic> {
  return httpPut<Topic>(`/topics/${id}`, { name, description });
}

export async function deleteTopic(id: string): Promise<void> {
  return httpDelete(`/topics/${id}`);
}

export async function importTrends(country: string = 'RO'): Promise<{ status: string; deleted: number; inserted: number }> {
  return httpPost<{ status: string; deleted: number; inserted: number }>('/topics/import_trends', { country });
}

// Announcements
export async function fetchAnnouncements(): Promise<Announcement[]> {
  return httpGet<Announcement[]>('/announcements');
}

export async function createAnnouncement(title: string, content: string, topic?: string | null, use_animated_banner?: boolean): Promise<Announcement> {
  return httpPost<Announcement>('/announcements', { title, content, topic, use_animated_banner: use_animated_banner ?? false });
}

export async function updateAnnouncement(id: string, title: string, content: string, topic?: string | null, use_animated_banner?: boolean): Promise<Announcement> {
  return httpPut<Announcement>(`/announcements/${id}`, { title, content, topic, use_animated_banner });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  return httpDelete(`/announcements/${id}`);
}

// Settings / Gemini
export async function getGeminiKey(): Promise<string> {
  const r = await httpGet<{ gemini_api_key?: string }>('/settings/gemini-key');
  return r.gemini_api_key ?? '';
}

export async function setGeminiKey(key: string): Promise<void> {
  const url = buildUrl('/settings/gemini-key');
  const trimmed = key.trim();
  const headerKey = getAdminApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (headerKey) headers['x-api-key'] = headerKey;

  const resp = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ gemini_api_key: key }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`PUT ${url} failed: ${resp.status} ${txt}`);
  }
}

// Autoposter controls
export async function getAutoposterStatus(): Promise<AutoposterStatus> {
  return httpGet<AutoposterStatus>('/autoposter/status');
}

export async function getAutoposterLogs(limit: number = 500): Promise<AutoposterLog[]> {
  const data = await httpGet<{ logs: AutoposterLog[] }>('/autoposter/logs', { limit });
  return Array.isArray(data.logs) ? data.logs : [];
}

export async function autoposterStart(): Promise<AutoposterStatus> {
  return httpPost<AutoposterStatus>('/autoposter/start', {});
}

export async function autoposterStop(): Promise<AutoposterStatus> {
  return httpPost<AutoposterStatus>('/autoposter/stop', {});
}

export async function autoposterReset(): Promise<AutoposterStatus> {
  return httpPost<AutoposterStatus>('/autoposter/reset', {});
}


