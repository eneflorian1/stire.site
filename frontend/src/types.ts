export type Article = {
  id: string;
  title: string;
  summary: string;
  image_url: string;
  source: string;
  published_at: string; // ISO string
  category: string;
};

export type ArticleDetail = Article & {
  slug: string;
  content_html: string; // server-generated rich HTML with backlinks
  meta_description: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Topic = {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
  imported_from?: string | null; // 'google_trends' pentru trenduri importate, null pentru manuale
  expires_at?: string | null; // ISO string pentru momentul expirării
};

export type TopicStatus = {
  topic_id: string;
  last_posted_at?: string | null;
  last_result?: string | null; // 'ok' | 'error' | etc
  last_error?: string | null;
  updated_at?: string | null;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  topic?: string | null;
  use_animated_banner?: boolean;
  created_at?: string | null;
};

export type AutoposterStatus = {
  running: boolean;
  started_at?: string | null;
  items_created?: number;
  last_error?: string | null;
  current_topic?: string | null;
};

export type AutoposterLog = {
  level: string; // INFO | WARNING | ERROR
  ts: string;    // ISO8601
  message: string;
};


