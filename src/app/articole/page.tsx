import ArticlesShell from '@/components/site/articles-shell';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { getArticles } from '@/lib/articles';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function ArticolePage({ searchParams }: Props) {
  const [articles, categories] = await Promise.all([getArticles(), getCategories()]);
  const resolvedSearchParams = await searchParams;
  let initialCategory = 'all';

  const rawCategorie = resolvedSearchParams?.categorie;

  if (Array.isArray(rawCategorie)) {
    if (typeof rawCategorie[0] === 'string' && rawCategorie[0]) {
      initialCategory = rawCategorie[0];
    }
  } else if (typeof rawCategorie === 'string' && rawCategorie) {
    initialCategory = rawCategorie;
  }
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Toate articolele</h1>
          <p className="text-sm text-slate-500">
            Foloseste cautarea si filtrele pentru a gasi rapid stirile dorite.
          </p>
        </div>
        <ArticlesShell
          articles={articles}
          categories={categories}
          initialCategory={initialCategory}
        />
      </main>
      <SiteFooter />
      <MobileNav active="home" />
    </div>
  );
}
