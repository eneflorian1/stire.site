import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import imageSize from 'image-size';
import { readJsonFile, writeJsonFile } from './json-store';
import { getTopics } from './topics';
import { getCategories } from './categories';
import { createArticle, getArticles } from './articles';
import { submitUrlToGoogle } from './google-indexing';
import { logSMGoogleSubmission } from './smgoogle';
import { slugify } from './strings';

export type GeminiState = {
  apiKey: string | null;
  credentialsJson: string | null;
  status: 'idle' | 'running' | 'stopped';
  startedAt: string | null;
  lastError: string | null;
  logs: GeminiLog[];
  // configuratie surse topicuri
  useManualTopics: boolean;
  useTrendTopics: boolean;
  // Statistici agregate pentru rularile Gemini
  totalArticlesCreated: number;
  lastRunAt: string | null;
  lastRunCreated: number;
  lastRunProcessedTopics: number;
  prevRunAt: string | null;
  prevRunCreated: number;
  prevRunProcessedTopics: number;
  // log detaliat per articol
  articleLogs: GeminiArticleLog[];
};

export type GeminiLog = {
  id: string;
  message: string;
  level: 'info' | 'error';
  createdAt: string;
};

export type GeminiArticleLogStatus = 'success' | 'error' | 'skipped';

export type GeminiArticleLog = {
  id: string;
  topicLabel: string;
  articleTitle?: string;
  articleId?: string;
  status: GeminiArticleLogStatus;
  message: string;
  createdAt: string;
  details?: string;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'gemini.json');
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_UPLOAD_URL_PREFIX = '/uploads';

// Rezolutie minima pentru imaginile de articol generate automat
// (evitam logo-uri foarte mici de tip 200x50 etc.)
const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 315;

const defaultState: GeminiState = {
  apiKey: null,
  credentialsJson: null,
  status: 'idle',
  startedAt: null,
  lastError: null,
  logs: [],
  useManualTopics: true,
  useTrendTopics: true,
  totalArticlesCreated: 0,
  lastRunAt: null,
  lastRunCreated: 0,
  lastRunProcessedTopics: 0,
  prevRunAt: null,
  prevRunCreated: 0,
  prevRunProcessedTopics: 0,
  articleLogs: [],
};

const MISSING_KEY_ERROR = 'Missing Gemini API key';

const createLogEntry = (
  message: string,
  level: GeminiLog['level'] = 'info',
  createdAt: string = new Date().toISOString()
): GeminiLog => ({
  id: randomUUID(),
  message,
  level,
  createdAt,
});

const createArticleLog = (input: {
  topicLabel: string;
  status: GeminiArticleLogStatus;
  message: string;
  articleTitle?: string;
  articleId?: string;
  details?: string;
  createdAt?: string;
}): GeminiArticleLog => ({
  id: randomUUID(),
  topicLabel: input.topicLabel,
  articleTitle: input.articleTitle,
  articleId: input.articleId,
  status: input.status,
  message: input.message,
  details: input.details,
  createdAt: input.createdAt ?? new Date().toISOString(),
});

const normalizeState = (state: Partial<GeminiState>): GeminiState => ({
  apiKey: state.apiKey ?? null,
  credentialsJson: state.credentialsJson ?? null,
  status: state.status ?? 'idle',
  startedAt: state.startedAt ?? null,
  lastError: state.lastError ?? null,
  logs: (state.logs ?? []).map((log) => ({
    id: log.id ?? randomUUID(),
    message: log.message ?? '',
    level: log.level === 'error' ? 'error' : 'info',
    createdAt: log.createdAt ?? new Date().toISOString(),
  })),
  useManualTopics:
    typeof state.useManualTopics === 'boolean' ? state.useManualTopics : true,
  useTrendTopics:
    typeof state.useTrendTopics === 'boolean' ? state.useTrendTopics : true,
  totalArticlesCreated: typeof state.totalArticlesCreated === 'number' ? state.totalArticlesCreated : 0,
  lastRunAt: state.lastRunAt ?? null,
  lastRunCreated: typeof state.lastRunCreated === 'number' ? state.lastRunCreated : 0,
  lastRunProcessedTopics:
    typeof state.lastRunProcessedTopics === 'number' ? state.lastRunProcessedTopics : 0,
  prevRunAt: state.prevRunAt ?? null,
  prevRunCreated:
    typeof state.prevRunCreated === 'number' ? state.prevRunCreated : 0,
  prevRunProcessedTopics:
    typeof state.prevRunProcessedTopics === 'number'
      ? state.prevRunProcessedTopics
      : 0,
  articleLogs: (state.articleLogs ?? []).map((log) => ({
    id: log.id ?? randomUUID(),
    topicLabel: log.topicLabel ?? '',
    articleTitle: log.articleTitle,
    articleId: log.articleId,
    status:
      log.status === 'error'
        ? 'error'
        : log.status === 'skipped'
        ? 'skipped'
        : 'success',
    message: log.message ?? '',
    details: log.details,
    createdAt: log.createdAt ?? new Date().toISOString(),
  })),
});

const normalizeHashtags = (raw: unknown): string | undefined => {
  if (!raw) return undefined;
  const text = String(raw);
  const parts = text
    .split(/[\s,;#]+/g)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const part of parts) {
    if (!seen.has(part)) {
      seen.add(part);
      uniq.push(part);
    }
  }
  if (!uniq.length) return undefined;
  return uniq.slice(0, 7).join(', ');
};

type GeminiGeneratedArticle = {
  title: string;
  category?: string | null;
  content?: string | null;
  hashtags?: string | null;
};

const ensureUploadsDir = async () => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch {
    // ignore
  }
};

const guessImageExtension = (url: string, contentType?: string | null) => {
  const lowerUrl = url.toLowerCase().split(/[?#]/)[0];
  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) return '.jpg';
  if (lowerUrl.endsWith('.png')) return '.png';
  if (lowerUrl.endsWith('.webp')) return '.webp';
  if (lowerUrl.endsWith('.gif')) return '.gif';
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('jpeg')) return '.jpg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  return '.jpg';
};

const searchImageForTopic = async (query: string): Promise<string | null> => {
  const q = encodeURIComponent(query.trim());
  const url = `https://www.google.com/search?q=${q}&tbm=isch&hl=ro&gl=RO`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();

  const regex = /https:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/gi;
  const candidates: string[] = [];
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(html)) !== null) {
    const candidate = match[0];
    if (!candidate.toLowerCase().includes('gstatic')) {
      candidates.push(candidate);
    }
    if (candidates.length >= 5) break;
  }

  return candidates[0] ?? null;
};

const downloadImageToUploads = async (
  remoteUrl: string,
  nameHint: string
): Promise<{ imageUrl: string; sourceUrl: string } | null> => {
  try {
    await ensureUploadsDir();
    const response = await fetch(remoteUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.google.com/',
      },
    });

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
      return null;
    }

    // Verificam rezolutia imaginii pentru a evita logo-uri foarte mici
    try {
      const dimensions = imageSize(bytes);
      const width = dimensions.width ?? 0;
      const height = dimensions.height ?? 0;
      if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
        // Imagine prea mica pentru a fi folosita ca imagine de articol
        return null;
      }
    } catch {
      // Daca nu putem determina dimensiunile, mai bine renuntam la imagine
      return null;
    }

    const contentType = response.headers.get('content-type');
    const ext = guessImageExtension(remoteUrl, contentType);
    const slug = slugify(nameHint || 'imagine');
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const filename = `${slug || 'imagine'}-${timestamp}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    await fs.writeFile(filePath, bytes);

    return {
      imageUrl: `${PUBLIC_UPLOAD_URL_PREFIX}/${filename}`,
      sourceUrl: remoteUrl,
    };
  } catch {
    return null;
  }
};

const callGeminiForTopic = async (
  apiKey: string,
  topicLabel: string,
  categoryOptions: string[]
): Promise<GeminiGeneratedArticle> => {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const instruction =
    'Genereaza STRICT un JSON (fara text aditional, fara code fences) cu campurile:\n' +
    "- title: titlu de stire profesionist, concis si puternic (max 120 caractere), fara prefixe sau ghilimele\n" +
    '- category: alege DOAR din lista oferita\n' +
    '- content: articol complet de stiri in limba romana (300–500 cuvinte), 3–6 paragrafe, clar, informativ, obiectiv; fara etichete precum "Rezumat:" sau "Titlu:"\n' +
    '  Paragrafele trebuie SEPARATE PRIN LINII GOALE (\\n\\n). Evita subtitluri, liste, bullet-uri sau marcaje decorative\n' +
    '  Primul paragraf trebuie sa fie LEAD-ul: rezuma ideea centrala, concis, autonom (nu depinde de paragrafele urmatoare), 2–4 fraze, max 400 de caractere.\n' +
    '  Include 3–6 ancore HTML (<a href=...>) pe cuvinte/expresii CHEIE care apar si in "hashtags". Leaga-le catre surse autoritative (Wikipedia, site oficial, .gov/.edu) daca sunt clare; altfel omite.\n' +
    '  Ancorele trebuie sa aiba: target="_blank" si rel="nofollow noopener". Nu face overlinking si nu folosi linkuri promotionale.\n' +
    '- hashtags: 5–7 cuvinte-cheie pentru SEO, derivate din title si content, fara #, separate prin virgula\n' +
    `Lista categorii permise: ${categoryOptions.join(', ')}.\n` +
    `Subiect: ${topicLabel}.`;

  const body = {
    contents: [{ parts: [{ text: instruction }] }],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${text || 'request failed'}`);
  }

  let raw: any;
  try {
    raw = await response.json();
  } catch (error) {
    throw new Error('Gemini a returnat un raspuns invalid (nu este JSON).');
  }

  let text =
    raw?.candidates?.[0]?.content?.parts?.[0]?.text ??
    raw?.candidates?.[0]?.output_text ??
    '';
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```[a-zA-Z]*\s*/u, '');
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    parsed = {};
  }

  return {
    title: String(parsed.title ?? topicLabel ?? '').trim() || topicLabel,
    category: parsed.category ?? null,
    content: typeof parsed.content === 'string' ? parsed.content : null,
    hashtags: typeof parsed.hashtags === 'string' ? parsed.hashtags : null,
  };
};

const generateArticlesFromTopics = async (state: GeminiState, maxArticles = 3) => {
  const allTopics = await getTopics();

  const topics = allTopics.filter((topic) => {
    if (topic.source === 'manual' && !state.useManualTopics) return false;
    if (topic.source === 'trend' && !state.useTrendTopics) return false;
    return true;
  });

  if (!topics.length) {
    return { created: 0, processedTopics: 0, articleLogs: [] as GeminiArticleLog[] };
  }

  const [categories, existingArticles] = await Promise.all([getCategories(), getArticles()]);
  const categoryNames = categories.map((category) => category.name);

  let created = 0;
  let processedTopics = 0;
  const articleLogs: GeminiArticleLog[] = [];

  for (const topic of topics) {
    if (created >= maxArticles) break;

    const label = topic.label.trim();
    if (!label) continue;
    processedTopics += 1;

    const labelLower = label.toLowerCase();
    const alreadyExists = existingArticles.some(
      (article) =>
        article.title.toLowerCase().includes(labelLower) ||
        article.summary.toLowerCase().includes(labelLower)
    );
    if (alreadyExists) {
      articleLogs.unshift(
        createArticleLog({
          topicLabel: label,
          status: 'skipped',
          message: 'Articol deja existent pentru acest topic (titlu sau rezumat asemanator).',
        })
      );
      continue;
    }

    try {
      if (!state.apiKey) {
        articleLogs.unshift(
          createArticleLog({
            topicLabel: label,
            status: 'error',
            message: 'Cheia Gemini lipseste in timpul generarii articolului.',
          })
        );
        // eslint-disable-next-line no-continue
        continue;
      }

      const generated = await callGeminiForTopic(state.apiKey, label, categoryNames);
      const content = generated.content?.trim();
      if (!content) {
        articleLogs.unshift(
          createArticleLog({
            topicLabel: label,
            status: 'skipped',
            message: 'Gemini nu a returnat continut pentru acest topic.',
          })
        );
        continue;
      }

      const firstParagraph = content.split(/\n\s*\n/)[0] ?? content;
      const mappedCategory =
        (generated.category && String(generated.category).trim()) ||
        categoryNames[0] ||
        'General';

      let imageUrl: string | undefined;
      let imageSourceUrl: string | undefined;
      try {
        const remoteUrl = await searchImageForTopic(label);
        if (remoteUrl) {
          imageSourceUrl = remoteUrl;
          const downloaded = await downloadImageToUploads(remoteUrl, label);
          if (downloaded) {
            imageUrl = downloaded.imageUrl;
            imageSourceUrl = downloaded.sourceUrl;
          } else {
            // daca nu reusim sa salvam local, renuntam la imagine pentru a evita erorile 400/404
            // din surse externe care blocheaza hotlinking
            imageUrl = undefined;
          }
        }
      } catch {
        // daca nu gasim imagine, continuam fara a bloca generarea articolului
      }

      const article = await createArticle(
        {
          title: generated.title.slice(0, 120),
          content,
          category: mappedCategory,
          hashtags: normalizeHashtags(generated.hashtags),
          imageUrl,
          imageSourceUrl,
        },
        { matchExistingCategory: true }
      );

      articleLogs.unshift(
        createArticleLog({
          topicLabel: label,
          articleTitle: article.title,
          articleId: article.id,
          status: 'success',
          message: 'Articol generat si salvat cu succes.',
        })
      );

      try {
        const submission = await submitUrlToGoogle(article.url);
        await logSMGoogleSubmission(article.url, submission, 'auto');
      } catch {
        // Ignoram erorile de logging/submit pentru a nu opri intregul ciclu
      }

      created += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Eroare neasteptata la generarea articolului.';
        articleLogs.unshift(
          createArticleLog({
            topicLabel: label,
            status: 'error',
            message: 'Eroare la generarea articolului.',
            details: message,
          })
        );
        // eslint-disable-next-line no-continue
        continue;
      }
  }

  return { created, processedTopics, articleLogs };
};

export const getGeminiState = async (): Promise<GeminiState> => {
  const data = await readJsonFile<GeminiState>(DATA_PATH, defaultState);
  return normalizeState(data);
};

const persistState = async (state: GeminiState) => {
  await writeJsonFile(DATA_PATH, state);
  return state;
};

export const updateGeminiApiKey = async (rawInput: string) => {
  const state = await getGeminiState();
  const trimmed = rawInput.trim();
  let savedKey: string | null = null;
  let storedJson: string | null = null;

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      const oauthSecret: unknown = parsed?.installed?.client_secret;
      if (typeof oauthSecret === 'string' && oauthSecret.trim()) {
        savedKey = oauthSecret.trim();
        storedJson = trimmed;
      } else {
        savedKey = trimmed;
      }
    } catch {
      savedKey = trimmed;
    }
  }

  state.apiKey = savedKey;
  state.credentialsJson = storedJson;
  state.lastError = state.apiKey ? null : MISSING_KEY_ERROR;
  const message = state.apiKey
    ? storedJson
      ? 'Configuratia OAuth Gemini a fost salvata.'
      : 'Cheia Gemini a fost actualizata.'
    : 'Cheia Gemini a fost stearsa.';
  state.logs = [createLogEntry(message), ...state.logs].slice(0, 100);
  return persistState(state);
};

export const updateGeminiConfig = async (config: {
  useManualTopics?: boolean;
  useTrendTopics?: boolean;
}) => {
  const state = await getGeminiState();
  if (typeof config.useManualTopics === 'boolean') {
    state.useManualTopics = config.useManualTopics;
  }
  if (typeof config.useTrendTopics === 'boolean') {
    state.useTrendTopics = config.useTrendTopics;
  }
  state.logs.unshift(
    createLogEntry('Configuratia surselor de topicuri Gemini a fost actualizata.', 'info')
  );
  state.logs = state.logs.slice(0, 100);
  return persistState(state);
};

export const deleteGeminiArticleLogs = async (ids?: string[]) => {
  const state = await getGeminiState();
  if (!ids || ids.length === 0) {
    state.articleLogs = [];
  } else {
    const idSet = new Set(ids);
    state.articleLogs = state.articleLogs.filter((log) => !idSet.has(log.id));
  }
  return persistState(state);
};

export const runGeminiAction = async (action: 'start' | 'stop' | 'reset') => {
  const state = await getGeminiState();
  const now = new Date().toISOString();

  if (action === 'start') {
    if (!state.apiKey) {
      state.lastError = MISSING_KEY_ERROR;
      state.logs.unshift(createLogEntry('Nu poti porni fara cheia API.', 'error', now));
    } else {
      state.status = 'running';
      state.startedAt = now;
      state.lastError = null;
      state.logs.unshift(createLogEntry('Gemini a fost pornit.', 'info', now));

      try {
        const previousRunAt = state.lastRunAt;
        const previousRunCreated = state.lastRunCreated ?? 0;
        const previousRunProcessed = state.lastRunProcessedTopics ?? 0;

        const { created, processedTopics, articleLogs } = await generateArticlesFromTopics(
          state,
          3
        );

        state.totalArticlesCreated = (state.totalArticlesCreated ?? 0) + created;
        state.prevRunAt = previousRunAt;
        state.prevRunCreated = previousRunCreated;
        state.prevRunProcessedTopics = previousRunProcessed;
        state.lastRunAt = now;
        state.lastRunCreated = created;
        state.lastRunProcessedTopics = processedTopics;
        state.articleLogs = [...articleLogs, ...state.articleLogs].slice(0, 200);
        if (created > 0) {
          state.logs.unshift(
            createLogEntry(
              `Gemini a creat ${created} articole noi din ${processedTopics} topicuri.`,
              'info'
            )
          );
        } else {
          state.logs.unshift(
            createLogEntry(
              processedTopics > 0
                ? 'Gemini nu a gasit topicuri noi pentru generare (deja acoperite).'
                : 'Nu exista topicuri disponibile pentru generare.',
              'info'
            )
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Eroare neasteptata la generarea articolelor cu Gemini.';
        state.lastError = message;
        state.logs.unshift(createLogEntry(`Eroare la generarea articolelor: ${message}`, 'error'));
      } finally {
        state.status = 'stopped';
      }
    }
  }

  if (action === 'stop') {
    state.status = 'stopped';
    state.logs.unshift(createLogEntry('Gemini a fost oprit.', 'info', now));
  }

  if (action === 'reset') {
    state.status = 'idle';
    state.startedAt = null;
    state.lastError = state.apiKey ? null : MISSING_KEY_ERROR;
    state.logs.unshift(createLogEntry('Starea Gemini a fost resetata.', 'info', now));
  }

  state.logs = state.logs.slice(0, 100);
  return persistState(state);
};
