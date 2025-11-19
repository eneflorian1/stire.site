import HomeShell from '@/components/site/home-shell';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { getArticles } from '@/lib/articles';
import { getCategories } from '@/lib/categories';

export default async function Home() {
  const [articles, categories] = await Promise.all([getArticles(), getCategories()]);
  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <SiteHeader />
      <main>
        <div className="bg-gradient-to-b from-white to-slate-100 px-4 py-12 text-center md:py-16">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Stire.site</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
            Toate stirile intr-o singura experienta.
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-500 md:text-base">
            Exploreaza ultimele articole, filtreaza pe categorii si revino rapid la subiectele
            preferate. Panoul admin ramane disponibil separat pentru redactori.
          </p>
        </div>
        <HomeShell articles={articles} categories={categories} />
      </main>
      <SiteFooter />
      <MobileNav active="home" />
    </div>
  );
}
