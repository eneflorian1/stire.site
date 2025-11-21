'use client';

import { useEffect, useState } from 'react';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import ArticleCard from '@/components/site/article-card';
import { getSavedArticles } from '@/lib/saved-articles';
import type { Article } from '@/lib/articles';

const SavedPage = () => {
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSavedArticles = async () => {
      try {
        const response = await fetch('/api/articles');
        if (response.ok) {
          const data = await response.json();
          // API returns {articles: Article[]} not Article[]
          const allArticles: Article[] = Array.isArray(data) ? data : (data.articles || []);
          const saved = getSavedArticles(allArticles);
          setSavedArticles(saved);
        }
      } catch (error) {
        console.error('Error fetching saved articles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedArticles();

    // Listen for storage changes to update saved articles in real-time
    const handleStorageChange = () => {
      fetchSavedArticles();
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-tab updates
    window.addEventListener('saved-articles-changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('saved-articles-changed', handleStorageChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <h1 className="text-2xl font-semibold text-slate-900">Articole salvate</h1>
        <p className="mt-2 text-sm text-slate-500">
          {savedArticles.length > 0
            ? `Ai ${savedArticles.length} ${savedArticles.length === 1 ? 'articol salvat' : 'articole salvate'}`
            : 'Salvează articole pentru a le citi mai târziu'}
        </p>

        {isLoading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Se încarcă...
          </div>
        ) : savedArticles.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            <p className="mb-2">Niciun articol salvat momentan.</p>
            <p className="text-xs">
              Apasă pe iconița de bookmark de pe orice articol pentru a-l salva aici.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedArticles.map((article) => (
              <ArticleCard key={article.id} article={article} variant="default" />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
      <MobileNav active="salvate" />
    </div>
  );
};

export default SavedPage;
