import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { ensureCategoryRecord, getCategories } from './categories';
import { encodeXml, slugify } from './strings';

export type ArticleStatus = 'draft' | 'published';

export type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  categorySlug: string;
  status: ArticleStatus;
  imageUrl?: string;
  imageSourceUrl?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  hashtags?: string;
};

export type ArticleInput = {
  title: string;
  content: string;
  category: string;
  imageUrl?: string;
  imageSourceUrl?: string;
  status?: ArticleStatus;
  publishedAt?: string;
  hashtags?: string;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'articles.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SITEMAP_FILES = {
  index: path.join(PUBLIC_DIR, 'sitemap.xml'),
  news: path.join(PUBLIC_DIR, 'sitemap-news.xml'),
  latest: path.join(PUBLIC_DIR, 'sitemap-articles-latest.xml'),
  categories: path.join(PUBLIC_DIR, 'sitemap-categories.xml'),
  images: path.join(PUBLIC_DIR, 'sitemap-images.xml'),
};
const RAW_BASE_URL = process.env.SITE_BASE_URL ?? 'https://stire.site';
const BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL.slice(0, -1) : RAW_BASE_URL;

const ensureDataFile = async () => {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, '[]', 'utf8');
  }
};

const normalizeExistingArticle = (article: Partial<Article>): Article | null => {
  if (!article.title || !article.summary || !article.content) {
    return null;
  }

  const categoryName = (article.category ?? 'general').trim() || 'general';
  const categorySlug = (article.categorySlug ?? slugify(categoryName)) || 'general';
  const slug = (article.slug ?? slugify(article.title)) || slugify('articol');
  const now = new Date().toISOString();

  return {
    id: article.id ?? randomUUID(),
    title: article.title.trim(),
    slug,
    summary: article.summary.trim(),
    content: article.content.trim(),
    category: categoryName,
    categorySlug,
    status: article.status === 'draft' ? 'draft' : 'published',
    imageUrl: article.imageUrl,
    imageSourceUrl: article.imageSourceUrl,
    publishedAt: article.publishedAt ?? now,
    createdAt: article.createdAt ?? now,
    updatedAt: article.updatedAt ?? now,
    url: article.url ?? buildArticleUrl(categorySlug, slug),
    hashtags: article.hashtags?.trim() || undefined,
  };
};

const readArticlesFromDisk = async (): Promise<Article[]> => {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  try {
    const parsed: Article[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeExistingArticle(item))
      .filter((item): item is Article => Boolean(item));
  } catch {
    return [];
  }
};

const writeArticlesToDisk = async (articles: Article[]) => {
  await fs.writeFile(DATA_PATH, JSON.stringify(articles, null, 2), 'utf8');
};

const buildArticleUrl = (categorySlug: string, articleSlug: string) =>
  `${BASE_URL}/Articol/${categorySlug}/${articleSlug}`;

const similarityScore = (a: string, b: string) => {
  const cleanA = a.toLowerCase();
  const cleanB = b.toLowerCase();
  if (!cleanA || !cleanB) {
    return 0;
  }
  if (cleanA === cleanB) {
    return 1;
  }
  const tokens = cleanB.split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const token of tokens) {
    if (cleanA.includes(token)) {
      hits += token.length;
    }
  }
  return hits / cleanA.length;
};

const mapCategoryToExisting = async (candidate: string) => {
  const normalized = candidate.trim();
  if (!normalized) return candidate;

  const categories = await getCategories();
  if (categories.length === 0) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  const exact = categories.find((category) => category.name.toLowerCase() === lower);
  if (exact) {
    return exact.name;
  }

  const slugMatch = categories.find((category) => category.slug === slugify(normalized));
  if (slugMatch) {
    return slugMatch.name;
  }

  const ranked = categories
    .map((category) => ({
      name: category.name,
      score: similarityScore(category.name, normalized),
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0] && ranked[0].score >= 0.4) {
    return ranked[0].name;
  }

  return categories[0].name;
};

const writeXml = async (filePath: string, xml: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, xml, 'utf8');
};

const buildUrlset = (entries: { loc: string; lastmod?: string; priority?: string }[]) => {
  const body = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : '';
      const priority = entry.priority ? `\n    <priority>${entry.priority}</priority>` : '';
      return `  <url>\n    <loc>${encodeXml(entry.loc)}</loc>${lastmod}${priority}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
};

const rebuildSitemaps = async (articles: Article[]) => {
  const published = [...articles]
    .filter((article) => article.status === 'published')
    // Ordonare cronologică crescătoare (dată + oră)
    .sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-news.xml</loc>\n  </sitemap>\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-articles-latest.xml</loc>\n  </sitemap>\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-categories.xml</loc>\n  </sitemap>\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-images.xml</loc>\n  </sitemap>\n</sitemapindex>\n`;
  await writeXml(SITEMAP_FILES.index, sitemapIndex);

  // Google News sitemap - ultimele articole (max ~50, oricum Google ia doar ~48h în calcul)
  // Luăm cele mai noi 50 din lista ordonată crescător.
  const latestArticles = published.slice(-50);
  const newsItems = latestArticles
    .map((article) => {
      const publicationDate = article.publishedAt || article.createdAt || article.updatedAt;
      if (!publicationDate) {
        return '';
      }
      return `  <url>
    <loc>${encodeXml(article.url)}</loc>
    <news:news>
      <news:publication>
        <news:name>stire.site</news:name>
        <news:language>ro</news:language>
      </news:publication>
      <news:publication_date>${publicationDate}</news:publication_date>
      <news:title>${encodeXml(article.title)}</news:title>
    </news:news>
  </url>`;
    })
    .filter(Boolean)
    .join('\n');

  const newsSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsItems}
</urlset>
`;
  await writeXml(SITEMAP_FILES.news, newsSitemapXml);

  const allEntries = published.map((article) => ({
    loc: article.url,
    lastmod: article.updatedAt ?? article.publishedAt,
    priority: '0.8',
  }));
  await writeXml(SITEMAP_FILES.latest, buildUrlset(allEntries));

  const categoriesMap = new Map<string, { name: string; lastmod: string }>();
  for (const article of published) {
    const existing = categoriesMap.get(article.categorySlug);
    const lastmod = article.updatedAt ?? article.publishedAt;
    if (!existing || new Date(lastmod).getTime() > new Date(existing.lastmod).getTime()) {
      categoriesMap.set(article.categorySlug, {
        name: article.category,
        lastmod,
      });
    }
  }
  const categoryEntries = Array.from(categoriesMap.entries())
    .map(([slug, data]) => ({
      // URL-urile reale de categorie/detaliu folosite in site sunt prin lista de articole,
      // filtrata cu ?categorie=<slug>.
      loc: `${BASE_URL}/articole?categorie=${slug}`,
      lastmod: data.lastmod,
      priority: '0.6',
    }))
    // Ordonăm categoriile după ultima modificare (data + ora), crescător.
    .sort(
      (a, b) =>
        new Date(a.lastmod ?? '').getTime() - new Date(b.lastmod ?? '').getTime()
    );
  await writeXml(SITEMAP_FILES.categories, buildUrlset(categoryEntries));

  const articlesWithImages = published.filter((article) => Boolean(article.imageUrl));
  const imageXmlEntries = articlesWithImages
    .map(
      (article) => {
        const rawImageUrl = article.imageUrl as string;
        const absoluteImageUrl =
          rawImageUrl.startsWith('http://') || rawImageUrl.startsWith('https://')
            ? rawImageUrl
            : `${BASE_URL}${rawImageUrl.startsWith('/') ? rawImageUrl : `/${rawImageUrl}`}`;

        return `  <url>
    <loc>${encodeXml(article.url)}</loc>
    <image:image>
      <image:loc>${encodeXml(absoluteImageUrl)}</image:loc>
      <image:title>${encodeXml(article.title)}</image:title>
    </image:image>
  </url>`;
      }
    )
    .join('\n');
  const imageXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${imageXmlEntries}\n</urlset>\n`;
  await writeXml(SITEMAP_FILES.images, imageXml);
};

export const getArticles = async () => {
  const articles = await readArticlesFromDisk();
  return articles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
};

export const deleteArticlesByIds = async (ids: string[]) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { deleted: 0, articles: await getArticles() };
  }
  const current = await readArticlesFromDisk();
  const idSet = new Set(ids);
  const remaining = current.filter((article) => !idSet.has(article.id));
  const deleted = current.length - remaining.length;
  if (deleted === 0) {
    return { deleted: 0, articles: current };
  }
  await writeArticlesToDisk(remaining);
  await rebuildSitemaps(remaining);
  return { deleted, articles: remaining };
};

export const getArticleBySlugs = async (categorySlug: string, slug: string) => {
  const articles = await readArticlesFromDisk();
  const normalizedCategory = (categorySlug ?? '').toLowerCase();
  return (
    articles.find((article) => {
      const storedCategorySlug =
        article.categorySlug ||
        (article.category ? slugify(article.category) : '') ||
        'general';
      return (
        storedCategorySlug.toLowerCase() === normalizedCategory && article.slug === slug
      );
    }) ?? null
  );
};

export const createArticle = async (
  input: ArticleInput,
  options?: { matchExistingCategory?: boolean }
) => {
  const articles = await readArticlesFromDisk();
  const baseSlug = slugify(input.title || 'articol') || 'articol';
  let slug = baseSlug;
  let counter = 1;
  while (articles.some((article) => article.slug === slug)) {
    slug = `${baseSlug}-${counter++}`;
  }

  const rawCategory = input.category?.trim() ?? '';
  let category = rawCategory || 'general';
  if (options?.matchExistingCategory) {
    category = await mapCategoryToExisting(category);
  }
  const categorySlug = slugify(category) || 'general';

  const now = new Date().toISOString();
  const publishedAt = input.publishedAt ? new Date(input.publishedAt).toISOString() : now;
  const article: Article = {
    id: randomUUID(),
    title: input.title.trim(),
    slug,
    summary: input.content.trim().slice(0, 300),
    content: input.content.trim(),
    category,
    categorySlug,
    status: input.status ?? 'published',
    imageUrl: input.imageUrl?.trim() || undefined,
    imageSourceUrl: input.imageSourceUrl?.trim() || undefined,
    publishedAt,
    createdAt: now,
    updatedAt: now,
    url: buildArticleUrl(categorySlug, slug),
    hashtags: input.hashtags?.trim() || undefined,
  };

  const updatedArticles = [article, ...articles];
  await writeArticlesToDisk(updatedArticles);
  await ensureCategoryRecord(category);
  await rebuildSitemaps(updatedArticles);
  return article;
};
