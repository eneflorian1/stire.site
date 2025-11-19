import HomeShell from '@/components/site/home-shell';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { getArticles } from '@/lib/articles';
import { getBannerSettings } from '@/lib/banner';
import { getCategories } from '@/lib/categories';

export default async function Home() {
  const [articles, categories, banner] = await Promise.all([
    getArticles(),
    getCategories(),
    getBannerSettings(),
  ]);
  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <SiteHeader showSearch />
      <main>
        <HomeShell articles={articles} categories={categories} banner={banner} />
      </main>
      <SiteFooter />
      <MobileNav active="home" />
    </div>
  );
}
