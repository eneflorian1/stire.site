import type { Metadata } from 'next';
import HomeShell from '@/components/site/home-shell';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import { getArticles } from '@/lib/articles';
import { getBannerSettings } from '@/lib/banner';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    absolute: 'stire.site – Știri curate, generate și curate automat',
  },
  description:
    'stire.site agregă și generează știri în limba română, pe categorii și subiecte actuale, cu sitemap-uri și indexare optimizate pentru Google.',
  alternates: {
    canonical: 'https://stire.site/',
  },
};

export default async function Home() {
  const [articles, categories, banner] = await Promise.all([
    getArticles(),
    getCategories(),
    getBannerSettings(),
  ]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'stire.site',
    url: 'https://stire.site',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://stire.site/articole?search={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <HomeShell articles={articles} categories={categories} banner={banner} />
      </main>
      <SiteFooter />
      <MobileNav active="home" />
    </div>
  );
}
