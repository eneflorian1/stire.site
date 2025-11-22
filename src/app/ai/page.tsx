'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Sparkles, X, Zap, TrendingUp } from 'lucide-react';
import MobileNav from '@/components/site/mobile-nav';
import SiteFooter from '@/components/site/site-footer';
import SiteHeader from '@/components/site/site-header';
import ArticleCard from '@/components/site/article-card';
import TopicSelector from '@/components/ai/topic-selector';
import ArticleSummaryCard from '@/components/ai/article-summary-card';
import CredibilityBadge from '@/components/ai/credibility-badge';
import RecommendationsSection from '@/components/ai/recommendations-section';
import TrackingTab from '@/components/ai/tracking-tab';
import { getSavedArticles } from '@/lib/saved-articles';
import { filterArticlesByCategories, filterArticlesByKeyword } from '@/lib/ai-filters';
import { useAIRecommendations } from '@/hooks/use-ai-analysis';
import type { Article } from '@/lib/articles';
import SearchBar from '@/components/site/search-bar';

type ViewMode = 'articles' | 'analysis' | 'recommendations' | 'tracking';

const AIPage = () => {
    const [savedArticles, setSavedArticles] = useState<Article[]>([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('articles');
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [analyzingArticle, setAnalyzingArticle] = useState<string | null>(null);
    const [articleAnalysis, setArticleAnalysis] = useState<Record<string, any>>({});

    const { recommendations, isLoading: loadingRecs, getRecommendations } = useAIRecommendations();

    useEffect(() => {
        const fetchSavedArticles = async () => {
            try {
                const response = await fetch('/api/articles');
                if (response.ok) {
                    const data = await response.json();
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
    }, []);

    // Filter articles based on search and categories
    const filteredArticles = useMemo(() => {
        let filtered = savedArticles;

        if (searchKeyword.trim()) {
            filtered = filterArticlesByKeyword(filtered, searchKeyword);
        }

        if (selectedTopics.length > 0) {
            filtered = filterArticlesByCategories(filtered, selectedTopics);
        }

        return filtered;
    }, [savedArticles, searchKeyword, selectedTopics]);

    const handleClearSearch = () => {
        setSearchKeyword('');
    };

    const handleTopicSelectionChange = (topicIds: string[]) => {
        setSelectedTopics(topicIds);
    };

    const handleAnalyzeArticle = async (article: Article) => {
        setAnalyzingArticle(article.id);
        setSelectedArticle(article);

        try {
            // Analyze credibility
            const credResponse = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId: article.id }),
            });

            // Generate summary
            const summaryResponse = await fetch('/api/ai/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId: article.id }),
            });

            const [credData, summaryData] = await Promise.all([
                credResponse.ok ? credResponse.json() : null,
                summaryResponse.ok ? summaryResponse.json() : null,
            ]);

            setArticleAnalysis((prev) => ({
                ...prev,
                [article.id]: {
                    credibility: credData?.credibility,
                    summary: summaryData?.summary,
                },
            }));

            setViewMode('analysis');
        } catch (error) {
            console.error('Error analyzing article:', error);
        } finally {
            setAnalyzingArticle(null);
        }
    };

    const handleGetRecommendations = async () => {
        setViewMode('recommendations');
        await getRecommendations(selectedTopics);
    };

    const hasActiveFilters = searchKeyword.trim() !== '' || selectedTopics.length > 0;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
                {/* Header Section */}


                {/* View Mode Tabs */}
                <div className="mb-8 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setViewMode('tracking')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${viewMode === 'tracking'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        🎯 Urmărire AI
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('articles')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${viewMode === 'articles'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        📰 Articole Salvate
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('analysis')}
                        disabled={!selectedArticle}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${viewMode === 'analysis'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        🔍 Analiză Detaliat ă
                    </button>
                    <button
                        type="button"
                        onClick={handleGetRecommendations}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${viewMode === 'recommendations'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        💡 Recomandări
                    </button>

                </div>

                {/* Articles View */}
                {viewMode === 'articles' && (
                    <>
                        {/* Topic Selector */}
                        <div className="mb-6 md:mb-8">
                            <TopicSelector onSelectionChange={handleTopicSelectionChange} />
                        </div>

                        {/* Keyword Search Section */}
                        <div className="mb-6 md:mb-8 rounded-xl md:rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900">
                                Caută după cuvânt cheie
                            </h2>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    placeholder="Ex: Bitcoin, programare, trading, crypto..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-12 text-slate-900 placeholder-slate-400 transition focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                />
                                {searchKeyword && (
                                    <button
                                        type="button"
                                        onClick={handleClearSearch}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <p className="mt-3 text-sm text-slate-500">
                                Căutarea se face în titlu, rezumat, conținut și hashtag-uri.
                            </p>
                        </div>

                        {/* Filtered Articles Section */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">
                                    {hasActiveFilters ? 'Rezultate căutare' : 'Articole salvate pentru analiză'}
                                </h2>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchKeyword('');
                                            setSelectedTopics([]);
                                        }}
                                        className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                                    >
                                        Resetează filtrele
                                    </button>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                                    Se încarcă...
                                </div>
                            ) : savedArticles.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                                    <Sparkles className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                                    <p className="mb-2 font-medium text-slate-900">Niciun articol salvat</p>
                                    <p className="text-sm text-slate-500">
                                        Salvează articole din homepage pentru a le analiza cu AI-ul.
                                    </p>
                                </div>
                            ) : filteredArticles.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                                    <Search className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                                    <p className="mb-2 font-medium text-slate-900">Niciun rezultat</p>
                                    <p className="text-sm text-slate-500">
                                        Încearcă alte cuvinte cheie sau topicuri.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p className="mb-4 text-sm text-slate-600">
                                        {filteredArticles.length} {filteredArticles.length === 1 ? 'articol găsit' : 'articole găsite'}
                                        {hasActiveFilters && ` din ${savedArticles.length} salvate`}
                                    </p>
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {filteredArticles.map((article) => (
                                            <div key={article.id} className="relative">
                                                <ArticleCard article={article} variant="compact" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleAnalyzeArticle(article)}
                                                    disabled={analyzingArticle === article.id}
                                                    className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                                                >
                                                    {analyzingArticle === article.id ? (
                                                        <>
                                                            <Sparkles className="h-4 w-4 animate-spin" />
                                                            Analizez...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Zap className="h-4 w-4" />
                                                            Analizează cu AI
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Analysis View */}
                {viewMode === 'analysis' && selectedArticle && (
                    <div className="space-y-6">
                        <button
                            type="button"
                            onClick={() => setViewMode('articles')}
                            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                            ← Înapoi la articole
                        </button>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="mb-4 text-2xl font-bold text-slate-900">{selectedArticle.title}</h2>
                            <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
                                <span>{selectedArticle.category}</span>
                                <span>•</span>
                                <span>{new Date(selectedArticle.publishedAt).toLocaleDateString('ro-RO')}</span>
                            </div>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Credibility */}
                            {articleAnalysis[selectedArticle.id]?.credibility && (
                                <CredibilityBadge credibility={articleAnalysis[selectedArticle.id].credibility} />
                            )}

                            {/* Summary */}
                            {articleAnalysis[selectedArticle.id]?.summary && (
                                <ArticleSummaryCard
                                    summary={articleAnalysis[selectedArticle.id].summary}
                                    articleTitle={selectedArticle.title}
                                />
                            )}
                        </div>

                        {!articleAnalysis[selectedArticle.id] && (
                            <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50 p-8 text-center">
                                <Sparkles className="mx-auto mb-4 h-12 w-12 text-violet-500" />
                                <p className="text-slate-700">Analizând articolul...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Recommendations View */}
                {viewMode === 'recommendations' && (
                    <div className="space-y-6">
                        <button
                            type="button"
                            onClick={() => setViewMode('articles')}
                            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                        >
                            ← Înapoi la articole
                        </button>

                        {loadingRecs ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                                <Sparkles className="mx-auto mb-4 h-12 w-12 animate-pulse text-violet-500" />
                                <p className="text-slate-700">Generez recomandări personalizate...</p>
                            </div>
                        ) : recommendations.length > 0 ? (
                            <RecommendationsSection recommendations={recommendations} />
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                                <TrendingUp className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                                <p className="mb-2 font-medium text-slate-900">Nicio recomandare disponibilă</p>
                                <p className="text-sm text-slate-500">
                                    Salvează mai multe articole sau selectează topicuri pentru recomandări personalizate.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tracking View */}
                {viewMode === 'tracking' && (
                    <TrackingTab />
                )}
            </main>
            <SiteFooter />
            <MobileNav active="ai" />
        </div>
    );
};

export default AIPage;
