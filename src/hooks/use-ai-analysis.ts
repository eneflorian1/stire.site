'use client';

import { useState } from 'react';
import type { CredibilityResult, SummaryResult } from '@/lib/ai-config';
import { getCachedResult, cacheCredibility, cacheSummary } from '@/lib/ai-cache';

type AnalysisState = {
    credibility?: CredibilityResult;
    summary?: SummaryResult;
    isAnalyzing: boolean;
    isSummarizing: boolean;
    error?: string;
};

/**
 * Hook for AI analysis operations
 */
export const useAIAnalysis = (articleId: string) => {
    const [state, setState] = useState<AnalysisState>({
        isAnalyzing: false,
        isSummarizing: false,
    });

    // Load from cache on mount
    useState(() => {
        const cached = getCachedResult(articleId);
        if (cached) {
            setState((prev) => ({
                ...prev,
                credibility: cached.credibility,
                summary: cached.summary,
            }));
        }
    });

    const analyzeCredibility = async () => {
        setState((prev) => ({ ...prev, isAnalyzing: true, error: undefined }));

        try {
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to analyze credibility');
            }

            const data = await response.json();

            // Cache result
            cacheCredibility(articleId, data.credibility, data.expiresAt);

            setState((prev) => ({
                ...prev,
                credibility: data.credibility,
                isAnalyzing: false,
            }));

            return data.credibility;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                error: errorMessage,
            }));
            throw error;
        }
    };

    const generateSummary = async () => {
        setState((prev) => ({ ...prev, isSummarizing: true, error: undefined }));

        try {
            const response = await fetch('/api/ai/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate summary');
            }

            const data = await response.json();

            // Cache result
            cacheSummary(articleId, data.summary, data.expiresAt);

            setState((prev) => ({
                ...prev,
                summary: data.summary,
                isSummarizing: false,
            }));

            return data.summary;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState((prev) => ({
                ...prev,
                isSummarizing: false,
                error: errorMessage,
            }));
            throw error;
        }
    };

    return {
        credibility: state.credibility,
        summary: state.summary,
        isAnalyzing: state.isAnalyzing,
        isSummarizing: state.isSummarizing,
        error: state.error,
        analyzeCredibility,
        generateSummary,
    };
};

/**
 * Hook for AI recommendations
 */
export const useAIRecommendations = () => {
    const [state, setState] = useState<{
        recommendations: any[];
        isLoading: boolean;
        error?: string;
    }>({
        recommendations: [],
        isLoading: false,
    });

    const getRecommendations = async (topics: string[]) => {
        setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

        try {
            const response = await fetch('/api/ai/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topics }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get recommendations');
            }

            const data = await response.json();

            setState({
                recommendations: data.recommendations,
                isLoading: false,
            });

            return data;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));
            throw error;
        }
    };

    return {
        recommendations: state.recommendations,
        isLoading: state.isLoading,
        error: state.error,
        getRecommendations,
    };
};
