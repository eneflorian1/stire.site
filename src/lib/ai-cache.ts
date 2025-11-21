// AI Cache Management
// Stores AI analysis results in localStorage to reduce API calls

import type { CachedAIResult, CredibilityResult, SummaryResult } from './ai-config';
import { isCacheExpired } from './ai-config';

const CACHE_KEY = 'ai-analysis-cache';

/**
 * Get all cached results
 */
const getCacheStore = (): Record<string, CachedAIResult> => {
    if (typeof window === 'undefined') return {};

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return {};
        return JSON.parse(cached);
    } catch {
        return {};
    }
};

/**
 * Save cache store
 */
const saveCacheStore = (store: Record<string, CachedAIResult>): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch (error) {
        console.error('Failed to save AI cache:', error);
    }
};

/**
 * Get cached result for an article
 */
export const getCachedResult = (articleId: string): CachedAIResult | null => {
    const store = getCacheStore();
    const cached = store[articleId];

    if (!cached) return null;

    // Check if expired
    if (isCacheExpired(cached.expiresAt)) {
        // Remove expired entry
        delete store[articleId];
        saveCacheStore(store);
        return null;
    }

    return cached;
};

/**
 * Cache credibility result
 */
export const cacheCredibility = (
    articleId: string,
    credibility: CredibilityResult,
    expiresAt: string
): void => {
    const store = getCacheStore();
    const existing = store[articleId] || { articleId, cachedAt: new Date().toISOString(), expiresAt };

    store[articleId] = {
        ...existing,
        credibility,
        expiresAt,
    };

    saveCacheStore(store);
};

/**
 * Cache summary result
 */
export const cacheSummary = (
    articleId: string,
    summary: SummaryResult,
    expiresAt: string
): void => {
    const store = getCacheStore();
    const existing = store[articleId] || { articleId, cachedAt: new Date().toISOString(), expiresAt };

    store[articleId] = {
        ...existing,
        summary,
        expiresAt,
    };

    saveCacheStore(store);
};

/**
 * Clear all cache
 */
export const clearCache = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = (): void => {
    const store = getCacheStore();
    const now = new Date();

    Object.keys(store).forEach((articleId) => {
        if (isCacheExpired(store[articleId].expiresAt)) {
            delete store[articleId];
        }
    });

    saveCacheStore(store);
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): {
    totalEntries: number;
    withCredibility: number;
    withSummary: number;
    expiredEntries: number;
} => {
    const store = getCacheStore();
    const entries = Object.values(store);

    return {
        totalEntries: entries.length,
        withCredibility: entries.filter((e) => e.credibility).length,
        withSummary: entries.filter((e) => e.summary).length,
        expiredEntries: entries.filter((e) => isCacheExpired(e.expiresAt)).length,
    };
};
