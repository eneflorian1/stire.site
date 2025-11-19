import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleCard from '@/components/site/article-card';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { getArticleBySlugs, getArticles } from '@/lib/articles';
import { slugify } from '@/lib/strings';

type ParamsPromise = Promise<{
  category: string;
  slug: string;
}>;

type PageProps = {
  params: ParamsPromise;
};

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({
    category: article.categorySlug || slugify(article.category ?? 'general'),
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, slug } = await params;
  const article = await getArticleBySlugs(category, slug);
  if (!article) {
    return {
      title: 'Articol indisponibil | stire.site',
    };
  }

  return {
    title: `${article.title} | stire.site`,
    description: article.summary,
    alternates: {
      canonical: article.url,
    },
    openGraph: {
      title: article.title,
      description: article.summary,
      type: 'article',
      url: article.url,
      images: article.imageUrl ? [{ url: article.imageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary,
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
  };
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const splitContent = (content: string) =>
  content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

export default async function ArticlePage({ params }: PageProps) {
  const { category, slug } = await params;
  const article = await getArticleBySlugs(category, slug);
  if (!article) {
    notFound();
  }

  const related = (await getArticles())
    .filter((item) => item.id !== article.id)
    .slice(0, 3);

  const hashtags = article.hashtags
    ? article.hashtags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:px-0">
        <article className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          {article.imageUrl && (
            <figure className="relative -mx-6 -mt-6 overflow-hidden rounded-t-3xl md:-mx-10 md:-mt-10">
              <img
                src={article.imageUrl}
                alt={article.title}
                title={article.title}
                className="h-64 w-full object-cover sm:h-80 md:h-96"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
              {article.imageSourceUrl && (
                  <a
                    href={article.imageSourceUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
                  >
                    Sursa
                  </a>
                )}
                <Link
                  href={`/categorii?selected=${article.categorySlug}`}
                  className="inline-flex items-center rounded-full bg-black/65 px-4 py-1 text-xs font-semibold text-white backdrop-blur"
                >
                  {article.category}
                </Link>
                
              </div>
            </figure>
          )}

          {!article.imageUrl && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href={`/categorii?selected=${article.categorySlug}`}
                className="inline-flex items-center rounded-full bg-slate-100 px-4 py-1 text-xs font-semibold text-slate-700"
              >
                {article.category}
              </Link>
            </div>
          )}

          <div className="space-y-2 pt-4">
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
              {article.title}
            </h1>
            <span className="text-sm text-slate-500">{formatDateTime(article.publishedAt)}</span>
          </div>

          <div className="space-y-5">
            {splitContent(article.content).map((block, index) => {
              const htmlBlock = block.includes('<a') || block.includes('<strong>') || block.includes('<em>');
              if (htmlBlock) {
                return (
                  <div
                    key={index}
                    className="leading-relaxed text-lg text-slate-800 [&_a]:text-sky-600 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: block.replace(/\n/g, '<br />') }}
                  />
                );
              }
              return (
                <p key={index} className="leading-relaxed text-lg text-slate-800">
                  {block}
                </p>
              );
            })}
          </div>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 text-xs text-slate-500">
              {hashtags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          )}
        </article>

        {related.length > 0 && (
          <section className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Alte articole</h2>
              <Link href="/" className="text-sm text-sky-600 hover:text-sky-700">
                Vezi toate &gt;
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((item) => (
                <ArticleCard key={item.id} article={item} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
      <MobileNav active="home" />
    </div>
  );
}
