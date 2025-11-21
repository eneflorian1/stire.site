import type { Article } from './articles';
import { AI_TOPICS } from './ai-topics';

/**
 * Filter articles by search keyword
 * Searches in title, summary, content, and hashtags
 */
export const filterArticlesByKeyword = (
    articles: Article[],
    keyword: string
): Article[] => {
    if (!keyword.trim()) return articles;

    const searchTerm = keyword.toLowerCase().trim();

    return articles.filter((article) => {
        const titleMatch = article.title.toLowerCase().includes(searchTerm);
        const summaryMatch = article.summary.toLowerCase().includes(searchTerm);
        const contentMatch = article.content.toLowerCase().includes(searchTerm);
        const hashtagsMatch = article.hashtags?.toLowerCase().includes(searchTerm) || false;

        return titleMatch || summaryMatch || contentMatch || hashtagsMatch;
    });
};

/**
 * Filter articles by selected topics
 * Matches article content against topic keywords
 */
export const filterArticlesByTopics = (
    articles: Article[],
    selectedTopicIds: string[]
): Article[] => {
    if (selectedTopicIds.length === 0) return articles;

    // Get keywords for selected topics
    const selectedTopics = AI_TOPICS.filter((topic) =>
        selectedTopicIds.includes(topic.id)
    );

    const allKeywords = selectedTopics.flatMap((topic) => topic.keywords);

    return articles.filter((article) => {
        const articleText = `${article.title} ${article.summary} ${article.content} ${article.hashtags || ''}`.toLowerCase();

        // Check if article contains any of the keywords
        return allKeywords.some((keyword) => articleText.includes(keyword.toLowerCase()));
    });
};

/**
 * Combined filter: search keyword + topics
 */
export const filterArticles = (
    articles: Article[],
    keyword: string,
    selectedTopicIds: string[]
): Article[] => {
    let filtered = articles;

    // Apply keyword filter
    if (keyword.trim()) {
        filtered = filterArticlesByKeyword(filtered, keyword);
    }

    // Apply topics filter
    if (selectedTopicIds.length > 0) {
        filtered = filterArticlesByTopics(filtered, selectedTopicIds);
    }

    return filtered;
};

/**
 * Filter articles by selected categories
 */
export const filterArticlesByCategories = (
    articles: Article[],
    selectedCategorySlugs: string[]
): Article[] => {
    if (selectedCategorySlugs.length === 0) return articles;

    return articles.filter((article) =>
        selectedCategorySlugs.includes(article.categorySlug)
    );
};

/**
 * Combined filter: search keyword + categories
 */
export const filterArticlesByKeywordAndCategories = (
    articles: Article[],
    keyword: string,
    selectedCategorySlugs: string[]
): Article[] => {
    let filtered = articles;

    // Apply keyword filter
    if (keyword.trim()) {
        filtered = filterArticlesByKeyword(filtered, keyword);
    }

    // Apply categories filter
    if (selectedCategorySlugs.length > 0) {
        filtered = filterArticlesByCategories(filtered, selectedCategorySlugs);
    }

    return filtered;
};
