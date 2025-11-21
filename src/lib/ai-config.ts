// AI Service Configuration
// This is a separate AI service, independent from the existing Gemini article generation

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'custom';

export type AIConfig = {
    provider: AIProvider;
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
};

// Credibility analysis result
export type CredibilityResult = {
    score: number; // 0-100
    level: 'high' | 'medium' | 'low';
    factors: {
        sourceReliability: number; // 0-100
        factualAccuracy: number; // 0-100
        biasDetection: number; // 0-100
    };
    highlights: Array<{
        text: string;
        isCredible: boolean;
        reason: string;
    }>;
    summary: string;
};

// Article summary result
export type SummaryResult = {
    brief: string; // 2-3 sentences
    keyPoints: string[];
    entities: Array<{
        name: string;
        type: 'person' | 'organization' | 'location' | 'technology' | 'concept';
    }>;
    sentiment: 'positive' | 'neutral' | 'negative';
    readingTime: number; // in minutes
};

// Recommendation result
export type Recommendation = {
    type: 'article' | 'tutorial' | 'resource' | 'video';
    title: string;
    url: string;
    description: string;
    reason: string; // Why this is recommended
    relevanceScore: number; // 0-100
    source?: string;
    imageUrl?: string;
};

export type RecommendationsResult = {
    recommendations: Recommendation[];
    basedOn: {
        topics: string[];
        keywords: string[];
        articleCount: number;
    };
};

// Cache entry for AI results
export type CachedAIResult = {
    articleId: string;
    credibility?: CredibilityResult;
    summary?: SummaryResult;
    cachedAt: string;
    expiresAt: string;
};

/**
 * Get AI configuration from environment
 */
export const getAIConfig = (): AIConfig | null => {
    if (typeof window !== 'undefined') {
        // Client-side: don't expose API keys
        return null;
    }

    const provider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    const apiKey = process.env.AI_API_KEY || '';

    if (!apiKey) {
        console.warn('AI_API_KEY not configured');
        return null;
    }

    return {
        provider,
        apiKey,
        model: process.env.AI_MODEL,
        maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS) : 1000,
        temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.7,
    };
};

/**
 * Calculate cache expiration (24 hours from now)
 */
export const getCacheExpiration = (): string => {
    const now = new Date();
    now.setHours(now.getHours() + 24);
    return now.toISOString();
};

/**
 * Check if cache entry is expired
 */
export const isCacheExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date();
};
