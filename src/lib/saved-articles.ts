import type { Article } from './articles';

const STORAGE_KEY = 'stire-saved-articles';

/**
 * Get all saved article IDs from localStorage
 */
export const getSavedArticleIds = (): string[] => {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return [];
        }
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * Check if an article is saved
 */
export const isArticleSaved = (articleId: string): boolean => {
    const savedIds = getSavedArticleIds();
    return savedIds.includes(articleId);
};

/**
 * Toggle saved status of an article
 * Returns the new saved status (true if now saved, false if now unsaved)
 */
export const toggleSavedArticle = (articleId: string): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const savedIds = getSavedArticleIds();
    const isSaved = savedIds.includes(articleId);

    let newSavedIds: string[];
    if (isSaved) {
        // Remove from saved
        newSavedIds = savedIds.filter((id) => id !== articleId);
    } else {
        // Add to saved
        newSavedIds = [articleId, ...savedIds];
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSavedIds));

        // Dispatch custom event for same-tab updates
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));

        return !isSaved;
    } catch {
        return isSaved;
    }
};

/**
 * Get all saved articles from a list of articles
 */
export const getSavedArticles = (allArticles: Article[]): Article[] => {
    // Validate that allArticles is actually an array
    if (!Array.isArray(allArticles)) {
        console.error('getSavedArticles: allArticles is not an array', allArticles);
        return [];
    }

    const savedIds = getSavedArticleIds();
    if (savedIds.length === 0) {
        return [];
    }

    const savedIdsSet = new Set(savedIds);
    return allArticles.filter((article) => savedIdsSet.has(article.id));
};
