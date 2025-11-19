import { randomUUID } from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './json-store';

export type TopicSource = 'manual' | 'trend';

export type Topic = {
  id: string;
  label: string;
  source: TopicSource;
  createdAt: string;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'topics.json');
const GOOGLE_TRENDS_BATCH_URL = 'https://trends.google.com/_/TrendsUi/data/batchexecute';

const normalizeTopic = (topic: Partial<Topic>): Topic | null => {
  if (!topic.label) return null;

  const label = topic.label.trim();
  if (!label) return null;

  const now = new Date().toISOString();
  return {
    id: topic.id ?? randomUUID(),
    label,
    source: topic.source === 'trend' ? 'trend' : 'manual',
    createdAt: topic.createdAt ?? now,
  };
};

const readTopics = async () => {
  const data = await readJsonFile<Topic[]>(DATA_PATH, []);
  return data
    .map((topic) => normalizeTopic(topic))
    .filter((topic): topic is Topic => Boolean(topic));
};

const writeTopics = async (topics: Topic[]) => writeJsonFile(DATA_PATH, topics);

export const getTopics = async () => {
  const topics = await readTopics();
  return topics.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const deleteTopicsByIds = async (ids: string[]) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { deleted: 0, topics: await getTopics() };
  }
  const current = await readTopics();
  const idSet = new Set(ids);
  const remaining = current.filter((topic) => !idSet.has(topic.id));
  const deleted = current.length - remaining.length;
  if (deleted === 0) {
    return { deleted: 0, topics: current };
  }
  await writeTopics(remaining);
  return { deleted, topics: remaining };
};

export const addManualTopic = async (label: string) => {
  const topics = await getTopics();
  if (topics.some((topic) => topic.label.toLowerCase() === label.toLowerCase())) {
    return topics.find((topic) => topic.label.toLowerCase() === label.toLowerCase()) as Topic;
  }

  const topic: Topic = {
    id: randomUUID(),
    label: label.trim(),
    source: 'manual',
    createdAt: new Date().toISOString(),
  };
  const updated = [topic, ...topics];
  await writeTopics(updated);
  return topic;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/**
 * Inspirat din implementarea Python `TrendCollector.search_trends`.
 * Folosește endpoint-ul intern Google Trends pentru a obține căutările populare.
 */
const fetchGoogleTrends = async (country = 'RO', retries = 3, retryDelayMs = 2000) => {
  const geo = country.toUpperCase().slice(0, 2);

  // Payload copiat din exemplul Python: f.req=[[["i0OFE","[null,null,\"{geo}\",0,null,48]"]]]
  const payload = `f.req=[[["i0OFE","[null,null,\\"${geo}\\",0,null,48]"]]]`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(GOOGLE_TRENDS_BATCH_URL, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Google Trends returned ${response.status}`);
      }

      const raw = await response.text();

      // Răspunsul este un JSON foarte „împachetat”; căutăm prima linie care începe cu '[',
      // apoi decodăm de două ori, similar cu exemplul Python.
      for (const line of raw.split('\n')) {
        if (!line.trim().startsWith('[')) continue;

        const data = JSON.parse(line);
        // data[0][2] este un string JSON care conține efectiv lista de trenduri
        const trendsJson = JSON.parse(data[0][2]);
        const items = trendsJson[1] as unknown[];

        const trends = (items ?? [])
          .map((item: any) => (Array.isArray(item) ? item[0] : null))
          .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
          .map((name) => decodeHtmlEntities(name.trim()));

        // Eliminăm duplicatele păstrând ordinea aproximativă
        const seen = new Set<string>();
        const uniq: string[] = [];
        for (const t of trends) {
          if (!seen.has(t)) {
            seen.add(t);
            uniq.push(t);
          }
        }

        if (uniq.length === 0) {
          throw new Error('Nu s-au găsit trenduri în răspunsul Google Trends.');
        }

        return uniq;
      }

      throw new Error('Nu s-a putut interpreta răspunsul Google Trends.');
    } catch (error) {
      // Păstrăm ultima eroare pentru a o raporta dacă toate încercările eșuează
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // Dacă am ajuns aici, toate încercările au eșuat
  console.error('Eroare la importul Google Trends:', lastError);
  throw new Error('Nu s-au putut obține trenduri Google. Încearcă din nou mai târziu.');
};

/**
 * Importă trendurile Google ca topicuri cu `source: 'trend'`.
 *
 * Inspirat de funcția Python `import_google_trends`:
 * - trendurile sunt regenerate de la zero
 * - topicurile manuale (`source: 'manual'`) rămân neatinse
 */
export const importTrendTopics = async (country = 'RO') => {
  const titles = await fetchGoogleTrends(country);

  if (!titles.length) {
    throw new Error('Nu am găsit topicuri Google Trends.');
  }

  // Citim toate topicurile existente
  const allTopics = await readTopics();

  // Păstrăm doar topicurile manuale; trendurile vechi le vom înlocui
  const manualTopics = allTopics.filter((topic) => topic.source !== 'trend');

  const now = new Date().toISOString();
  const newTrendTopics: Topic[] = [];

  for (const rawLabel of titles) {
    const label = rawLabel?.trim();
    if (!label) continue;

    // Evităm duplicatele față de manuale și față de trendurile din același import
    const existsInManual = manualTopics.some(
      (topic) => topic.label.toLowerCase() === label.toLowerCase()
    );
    const existsInBatch = newTrendTopics.some(
      (topic) => topic.label.toLowerCase() === label.toLowerCase()
    );
    if (existsInManual || existsInBatch) continue;

    newTrendTopics.push({
      id: randomUUID(),
      label,
      source: 'trend',
      createdAt: now,
    });
  }

  // Îmbinăm: noile trenduri + manualele existente
  const updatedTopics = [...newTrendTopics, ...manualTopics];
  await writeTopics(updatedTopics);

  return newTrendTopics;
};
