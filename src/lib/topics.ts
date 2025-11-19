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
const GOOGLE_TRENDS_API =
  'https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=-180&geo=RO';

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

export const importTrendTopics = async () => {
  const response = await fetch(GOOGLE_TRENDS_API, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
    },
    cache: 'no-store',
  });
  const payload = await response.text();
  const normalized = payload.replace(")]}',", '').trim();
  const json = JSON.parse(normalized);
  const trendDays = json.default?.trendingSearchesDays ?? [];
  const labels: string[] = [];

  for (const day of trendDays) {
    const searches = day.trendingSearches ?? [];
    for (const search of searches) {
      if (search?.title?.query) {
        labels.push(search.title.query);
      }
    }
  }

  const topics = await getTopics();
  const newTopics: Topic[] = [];
  for (const label of labels) {
    if (topics.some((topic) => topic.label.toLowerCase() === label.toLowerCase())) {
      continue;
    }
    const topic: Topic = {
      id: randomUUID(),
      label,
      source: 'trend',
      createdAt: new Date().toISOString(),
    };
    topics.unshift(topic);
    newTopics.push(topic);
  }

  await writeTopics(topics);
  return newTopics;
};
