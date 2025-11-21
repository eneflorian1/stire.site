import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, getCacheExpiration } from '@/lib/ai-config';
import { createAIService } from '@/lib/ai-service';
import { getArticles } from '@/lib/articles';

/**
 * POST /api/ai/analyze
 * Analyze article credibility
 */
export async function POST(request: NextRequest) {
    try {
        const { articleId } = await request.json();

        if (!articleId) {
            return NextResponse.json(
                { error: 'Article ID is required' },
                { status: 400 }
            );
        }

        // Get AI configuration
        const config = getAIConfig();
        if (!config) {
            return NextResponse.json(
                { error: 'AI service not configured. Please set AI_API_KEY environment variable.' },
                { status: 503 }
            );
        }

        // Get article
        const articles = await getArticles();
        const article = articles.find((a) => a.id === articleId);

        if (!article) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            );
        }

        // Analyze credibility
        const aiService = createAIService(config);
        const credibility = await aiService.analyzeCredibility(article);

        return NextResponse.json({
            credibility,
            cachedAt: new Date().toISOString(),
            expiresAt: getCacheExpiration(),
        });
    } catch (error) {
        console.error('AI analyze error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to analyze article' },
            { status: 500 }
        );
    }
}
