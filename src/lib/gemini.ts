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
  penultimateRunAt: string | null;
  penultimateRunCreated: number;
  // log detaliat per articol
  articleLogs: GeminiArticleLog[];
  // tracking pentru topicuri (cand au fost postate ultima data)
  topicLastPosted: Record<string, string>; // topic label -> ISO timestamp
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
  error?: string;
  articleSlug?: string;
  categoryName?: string;
  sourceUrl?: string;
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
  penultimateRunAt: null,
  penultimateRunCreated: 0,
  articleLogs: [],
  topicLastPosted: {},
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
  penultimateRunAt: state.penultimateRunAt ?? null,
  penultimateRunCreated: typeof state.penultimateRunCreated === 'number' ? state.penultimateRunCreated : 0,
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
  topicLastPosted: state.topicLastPosted && typeof state.topicLastPosted === 'object' ? state.topicLastPosted : {},
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

// Verifica daca exista stiri recente (max 3 zile) pentru un topic
const searchRecentNewsForTopic = async (query: string): Promise<boolean> => {
  try {
    const q = encodeURIComponent(query.trim());
    // Folosim Google News RSS feed pentru Romania
    const url = `https://news.google.com/rss/search?q=${q}&hl=ro&gl=RO&ceid=RO:ro`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return false;
    }

    const xml = await response.text();

    // Parseaza XML-ul pentru a gasi datele articolelor
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/gi;
    const dates: Date[] = [];
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = pubDateRegex.exec(xml)) !== null) {
      try {
        const dateStr = match[1];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      } catch {
        // Ignora datele invalide
      }
    }

    if (dates.length === 0) {
      return false;
    }

    // Verifica daca exista cel putin un articol din ultimele 3 zile
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    return dates.some((date) => {
      const articleAge = now - date.getTime();
      return articleAge <= THREE_DAYS && articleAge >= 0;
    });
  } catch {
    return false;
  }
};

const searchImageForTopic = async (
  query: string,
  logger?: (msg: string) => void
): Promise<string | null> => {
  const log = logger ?? (() => { });

  try {
    const q = encodeURIComponent(query.trim());
    const url = `https://www.google.com/search?q=${q}&tbm=isch&hl=ro&gl=RO`;

    log(`🔍 Cautare imagine pentru: "${query}"`);

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
      log(`❌ Eroare HTTP la cautare imagine: ${response.status}`);
      return null;
    }

    const html = await response.text();
    log(`📄 HTML primit: ${html.length} caractere`);

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

    log(`🖼️  Imagini candidate gasite: ${candidates.length}`);
    if (candidates.length > 0) {
      log(`✅ Prima imagine: ${candidates[0].substring(0, 80)}...`);
    } else {
      log(`⚠️  Nu s-au gasit imagini candidate`);
    }

    return candidates[0] ?? null;
  } catch (error) {
    log(`💥 Eroare la cautare imagine: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`);
    return null;
  }
};

const downloadImageToUploads = async (
  remoteUrl: string,
  nameHint: string,
  logger?: (msg: string) => void
): Promise<{ imageUrl: string; sourceUrl: string } | null> => {
  const log = logger ?? (() => { });

  try {
    log(`📥 Incercare download imagine: ${remoteUrl.substring(0, 80)}...`);

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
      log(`❌ Eroare HTTP la download imagine: ${response.status} ${response.statusText}`);
      return null;
    }

    log(`✅ Raspuns HTTP: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const sizeKB = Math.round(bytes.length / 1024);

    log(`📦 Dimensiune fisier: ${sizeKB} KB`);

    if (!bytes.length) {
      log(`❌ Fisier gol (0 bytes)`);
      return null;
    }

    if (bytes.length > 10 * 1024 * 1024) {
      log(`❌ Fisier prea mare: ${sizeKB} KB (max 10 MB)`);
      return null;
    }

    // Verificam rezolutia imaginii pentru a evita logo-uri foarte mici
    try {
      const dimensions = imageSize(bytes);
      const width = dimensions.width ?? 0;
      const height = dimensions.height ?? 0;

      log(`📐 Rezolutie imagine: ${width}x${height}px`);

      if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
        log(`❌ Rezolutie prea mica: ${width}x${height}px (minim: ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px)`);
        return null;
      }

      log(`✅ Rezolutie acceptabila`);
    } catch (error) {
      log(`❌ Nu s-a putut determina rezolutia imaginii: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    const ext = guessImageExtension(remoteUrl, contentType);
    const slug = slugify(nameHint || 'imagine');
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const filename = `${slug || 'imagine'}-${timestamp}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    log(`💾 Salvare imagine: ${filename}`);

    await fs.writeFile(filePath, bytes);

    const publicUrl = `${PUBLIC_UPLOAD_URL_PREFIX}/${filename}`;
    log(`✅ Imagine salvata cu succes: ${publicUrl}`);

    return {
      imageUrl: publicUrl,
      sourceUrl: remoteUrl,
    };
  } catch (error) {
    log(`💥 Eroare la download/salvare imagine: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`);
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
    '  Include 3–6 ancore HTML (<a href=...>) pe cuvinte/expresii CHEIE. Leaga-le catre surse autoritative DIVERSE (site-uri de stiri reputate, site-uri oficiale, .gov, .edu, Wikipedia etc.).\n' +
    '  IMPORTANT: Nu folosi acelasi domeniu de doua ori (de exemplu, maxim 1 link catre Wikipedia, maxim 1 catre un site de stiri specific etc.). Diversifica sursele!\n' +
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

// Genereaza un singur articol din topicurile disponibile
// Respecta regula de 24h per topic si verifica duplicate in ultimele 24h
const generateSingleArticle = async (state: GeminiState): Promise<{
  created: boolean;
  topicLabel: string | null;
  articleLog: GeminiArticleLog | null;
}> => {
  const allTopics = await getTopics();
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Filtreaza topicurile pe baza configuratiei
  const topics = allTopics.filter((topic) => {
    if (topic.source === 'manual' && !state.useManualTopics) return false;
    if (topic.source === 'trend' && !state.useTrendTopics) return false;
    return true;
  });

  if (!topics.length) {
    return { created: false, topicLabel: null, articleLog: null };
  }

  // Gaseste primul topic care nu a fost postat in ultimele 24h
  let selectedTopic = null;
  for (const topic of topics) {
    const label = topic.label.trim();
    if (!label) continue;

    const lastPosted = state.topicLastPosted[label];
    if (lastPosted) {
      const lastPostedTime = new Date(lastPosted).getTime();
      const timeSinceLastPost = now - lastPostedTime;
      if (timeSinceLastPost < TWENTY_FOUR_HOURS) {
        // Skip - postat in ultimele 24h
        continue;
      }
    }

    selectedTopic = { ...topic, label };
    break;
  }

  if (!selectedTopic) {
    // Toate topicurile au fost postate in ultimele 24h
    return { created: false, topicLabel: null, articleLog: null };
  }

  const label = selectedTopic.label;
  const labelLower = label.toLowerCase();

  // Verifica daca exista stiri recente (max 3 zile) pentru acest topic
  const hasRecentNews = await searchRecentNewsForTopic(label);
  if (!hasRecentNews) {
    const log = createArticleLog({
      topicLabel: label,
      status: 'skipped',
      message: 'Nu exista stiri recente (max 3 zile) pentru acest topic.',
    });
    return { created: false, topicLabel: label, articleLog: log };
  }

  // Verifica duplicate in articolele din ultimele 24h
  const existingArticles = await getArticles();
  const recentArticles = existingArticles.filter((article) => {
    const articleTime = new Date(article.createdAt).getTime();
    return now - articleTime < TWENTY_FOUR_HOURS;
  });

  const isDuplicate = recentArticles.some(
    (article) =>
      article.title.toLowerCase().includes(labelLower) ||
      article.summary.toLowerCase().includes(labelLower) ||
      (article.content && article.content.toLowerCase().includes(labelLower))
  );

  if (isDuplicate) {
    const log = createArticleLog({
      topicLabel: label,
      status: 'skipped',
      message: 'Topic similar gasit in articolele din ultimele 24h.',
    });
    return { created: false, topicLabel: label, articleLog: log };
  }

  // Genereaza articolul
  try {
    if (!state.apiKey) {
      const log = createArticleLog({
        topicLabel: label,
        status: 'error',
        message: 'Cheia Gemini lipseste.',
      });
      return { created: false, topicLabel: label, articleLog: log };
    }

    const categories = await getCategories();
    const categoryNames = categories.map((category) => category.name);

    const generated = await callGeminiForTopic(state.apiKey, label, categoryNames);
    const content = generated.content?.trim();
    if (!content) {
      const log = createArticleLog({
        topicLabel: label,
        status: 'skipped',
        message: 'Gemini nu a returnat continut pentru acest topic.',
      });
      return { created: false, topicLabel: label, articleLog: log };
    }

    const mappedCategory =
      (generated.category && String(generated.category).trim()) ||
      categoryNames[0] ||
      'General';

    // Loguri detaliate pentru procesul de imagine
    const imageLogs: string[] = [];
    const imageLogger = (msg: string) => {
      imageLogs.push(msg);
      console.log(`[IMAGE] ${msg}`);
    };

    let imageUrl: string | undefined;
    let imageSourceUrl: string | undefined;

    imageLogger(`🎨 Incepere proces cautare imagine pentru topic: "${label}"`);

    try {
      const remoteUrl = await searchImageForTopic(label, imageLogger);

      if (remoteUrl) {
        imageSourceUrl = remoteUrl;
        imageLogger(`✅ URL imagine gasit, incercare download...`);

        const downloaded = await downloadImageToUploads(remoteUrl, label, imageLogger);

        if (downloaded) {
          imageUrl = downloaded.imageUrl;
          imageSourceUrl = downloaded.sourceUrl;
          imageLogger(`🎉 Proces imagine finalizat cu succes!`);
        } else {
          imageLogger(`⚠️  Download imagine esuat (verificati logurile de mai sus pentru detalii)`);
        }
      } else {
        imageLogger(`⚠️  Nu s-a gasit niciun URL de imagine`);
      }
    } catch (error) {
      imageLogger(`💥 Eroare neasteptata la procesare imagine: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`);
    }

    const imageLogSummary = imageLogs.join('\n');

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

    const log = createArticleLog({
      topicLabel: label,
      articleTitle: article.title,
      articleId: article.id,
      status: 'success',
      message: 'Articol generat si salvat cu succes.',
      details: imageUrl
        ? `Imagine salvata: ${imageUrl}\n\n--- Loguri imagine ---\n${imageLogSummary}`
        : `Articol fara imagine.\n\n--- Loguri imagine ---\n${imageLogSummary}`,
    });

    try {
      const submission = await submitUrlToGoogle(article.url);
      await logSMGoogleSubmission(article.url, submission, 'auto');
    } catch {
      // Ignoram erorile de logging
    }

    // Actualizeaza timestamp-ul pentru acest topic
    state.topicLastPosted[label] = new Date().toISOString();

    return { created: true, topicLabel: label, articleLog: log };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Eroare neasteptata la generarea articolului.';
    const log = createArticleLog({
      topicLabel: label,
      status: 'error',
      message: 'Eroare la generarea articolului.',
      details: message,
    });
    return { created: false, topicLabel: label, articleLog: log };
  }
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

// Global interval pentru loop-ul continuu
// Folosim globalThis pentru a preveni duplicate in development (HMR)
declare global {
  // eslint-disable-next-line no-var
  var geminiLoopTimeout: NodeJS.Timeout | null | undefined;
}

// Functie pentru loop-ul continuu de generare
const startContinuousLoop = async () => {
  const INTERVAL_MS = 12000; // 12 secunde

  const runLoop = async () => {
    try {
      // Citeste starea curenta
      let state = await getGeminiState();

      // Verifica daca trebuie sa oprim loop-ul
      if (state.status !== 'running') {
        return;
      }

      // Incearca sa generezi un articol
      const result = await generateSingleArticle(state);

      // Actualizeaza starea
      // Actualizeaza starea
      state = await getGeminiState(); // Re-citeste pentru a avea ultima versiune

      // Actualizam timestamp-ul topicului daca a fost procesat (success sau skipped)
      // Nu actualizam la eroare, pentru a permite retry
      if (result.topicLabel && result.articleLog) {
        if (result.articleLog.status === 'success' || result.articleLog.status === 'skipped') {
          state.topicLastPosted[result.topicLabel] = new Date().toISOString();
        }
      }

      if (result.articleLog) {
        state.articleLogs = [result.articleLog, ...state.articleLogs].slice(0, 200);
      }

      if (result.created) {
        state.totalArticlesCreated = (state.totalArticlesCreated ?? 0) + 1;
        state.lastRunAt = new Date().toISOString();
        state.lastRunCreated = (state.lastRunCreated ?? 0) + 1;
        state.lastRunProcessedTopics = (state.lastRunProcessedTopics ?? 0) + 1;
        state.logs.unshift(
          createLogEntry(`Articol generat: ${result.topicLabel}`, 'info')
        );
      } else if (result.topicLabel) {
        // Topic procesat dar nu s-a creat articol
        state.logs.unshift(
          createLogEntry(`Topic procesat: ${result.topicLabel} - ${result.articleLog?.message || 'skipped'}`, 'info')
        );
      } else {
        // Nu mai sunt topicuri disponibile
        state.logs.unshift(
          createLogEntry('Toate topicurile au fost procesate in ultimele 24h. Asteptam...', 'info')
        );
      }

      state.logs = state.logs.slice(0, 100);

      // Salveaza starea
      await persistState(state);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Eroare in loop-ul continuu';
      console.error('Gemini loop error:', message);

      try {
        const state = await getGeminiState();
        state.lastError = message;
        state.logs.unshift(createLogEntry(`Eroare: ${message}`, 'error'));
        state.logs = state.logs.slice(0, 100);
        await persistState(state);
      } catch {
        // Ignore persistence errors
      }
    } finally {
      // Programeaza urmatoarea rulare doar daca starea e inca running
      // Verificam din nou starea din fisier pentru a fi siguri ca nu s-a dat stop intre timp
      try {
        const currentState = await getGeminiState();
        if (currentState.status === 'running') {
          global.geminiLoopTimeout = setTimeout(runLoop, INTERVAL_MS);
        } else {
          global.geminiLoopTimeout = null;
        }
      } catch {
        // Daca nu putem citi starea, ne oprim
        global.geminiLoopTimeout = null;
      }
    }
  };

  // Ruleaza imediat prima data
  await runLoop();
};

export const initGeminiLoop = async () => {
  try {
    const state = await getGeminiState();
    if (state.status === 'running' && !global.geminiLoopTimeout) {
      console.log('Restarting Gemini loop...');
      startContinuousLoop().catch((error) => {
        console.error('Failed to auto-restart continuous loop:', error);
      });
    }
  } catch (error) {
    console.error('Failed to init Gemini loop:', error);
  }
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
      state.logs.unshift(createLogEntry('Gemini automation a fost pornit.', 'info', now));

      // Reseteaza contoarele pentru noua rulare
      state.penultimateRunAt = state.prevRunAt;
      state.penultimateRunCreated = state.prevRunCreated ?? 0;
      state.prevRunAt = state.lastRunAt;
      state.prevRunCreated = state.lastRunCreated ?? 0;
      state.prevRunProcessedTopics = state.lastRunProcessedTopics ?? 0;
      state.lastRunCreated = 0;
      state.lastRunProcessedTopics = 0;

      await persistState(state);

      // Porneste loop-ul continuu in background daca nu ruleaza deja
      if (!global.geminiLoopTimeout) {
        startContinuousLoop().catch((error) => {
          console.error('Failed to start continuous loop:', error);
        });
      }
    }
  }

  if (action === 'stop') {
    state.status = 'stopped';
    state.logs.unshift(createLogEntry('Gemini automation a fost oprit.', 'info', now));

    // Opreste loop-ul
    if (global.geminiLoopTimeout) {
      clearTimeout(global.geminiLoopTimeout);
      global.geminiLoopTimeout = null;
    }
  }

  if (action === 'reset') {
    state.status = 'idle';
    state.startedAt = null;
    state.lastError = state.apiKey ? null : MISSING_KEY_ERROR;
    state.logs.unshift(createLogEntry('Starea Gemini a fost resetata.', 'info', now));

    // Opreste loop-ul daca ruleaza
    if (global.geminiLoopTimeout) {
      clearTimeout(global.geminiLoopTimeout);
      global.geminiLoopTimeout = null;
    }
  }

  state.logs = state.logs.slice(0, 100);
  return persistState(state);
};
