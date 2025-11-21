import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig } from '@/lib/ai-config';
import { createAIService } from '@/lib/ai-service';
import { getArticles } from '@/lib/articles';
import { getSavedArticleIds } from '@/lib/saved-articles';

/**
 * POST /api/ai/recommend
 * Get personalized recommendations based on saved articles and topics
 */
export async function POST(request: NextRequest) {
    try {
        const { topics = [] } = await request.json();

        // Get AI configuration
        const config = getAIConfig();
        if (!config) {
            return NextResponse.json(
                { error: 'AI service not configured. Please set AI_API_KEY environment variable.' },
                { status: 503 }
            );
        }

        // Get saved articles
        const savedIds = getSavedArticleIds();
        if (savedIds.length === 0) {
            return NextResponse.json({
                recommendations: [],
                basedOn: {
                    topics,
                    keywords: [],
                    articleCount: 0,
                },
            });
        }

        const allArticles = await getArticles();
        const savedArticles = allArticles.filter((a) => savedIds.includes(a.id));

        // Get recommendations
        const aiService = createAIService(config);
        const recommendations = await aiService.getRecommendations(savedArticles, topics);

        // Extract keywords from saved articles
        const keywords = Array.from(
            new Set(
                savedArticles
                    .flatMap((a) => a.hashtags?.split(',').map((h) => h.trim()) || [])
                    .filter(Boolean)
            )
        ).slice(0, 10);

        return NextResponse.json({
            recommendations,
            basedOn: {
                topics,
                keywords,
                articleCount: savedArticles.length,
            },
        });
    } catch (error) {
        console.error('AI recommend error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate recommendations' },
            { status: 500 }
        );
    }
}
