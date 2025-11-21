// Generic AI Service
// Adapter pattern to support multiple AI providers

import type { AIConfig, CredibilityResult, SummaryResult, Recommendation } from './ai-config';
import type { Article } from './articles';

/**
 * Generic AI service interface
 */
export interface AIService {
    analyzeCredibility(article: Article): Promise<CredibilityResult>;
    generateSummary(article: Article): Promise<SummaryResult>;
    getRecommendations(articles: Article[], topics: string[]): Promise<Recommendation[]>;
    generateContent(prompt: string): Promise<string>;
}

/**
 * Generic AI provider implementation
 * This can be extended to support OpenAI, Anthropic, Gemini, etc.
 */
export class GenericAIService implements AIService {
    constructor(private config: AIConfig) { }

    /**
     * Call AI API with generic prompt
     */
    private async callAI(prompt: string): Promise<string> {
        const { provider, apiKey, model, maxTokens, temperature } = this.config;

        // Generic implementation - can be customized per provider
        const endpoint = this.getEndpoint(provider);
        const headers = this.getHeaders(provider, apiKey);
        const body = this.getRequestBody(provider, prompt, model, maxTokens, temperature);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.extractResponse(provider, data);
    }

    /**
     * Get API endpoint based on provider
     */
    private getEndpoint(provider: string): string {
        switch (provider) {
            case 'openai':
                return 'https://api.openai.com/v1/chat/completions';
            case 'anthropic':
                return 'https://api.anthropic.com/v1/messages';
            case 'gemini':
                const model = this.config.model || 'gemini-pro';
                return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    /**
     * Get request headers based on provider
     */
    private getHeaders(provider: string, apiKey: string): Record<string, string> {
        const baseHeaders = { 'Content-Type': 'application/json' };

        switch (provider) {
            case 'openai':
                return { ...baseHeaders, Authorization: `Bearer ${apiKey}` };
            case 'anthropic':
                return { ...baseHeaders, 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
            case 'gemini':
                return baseHeaders; // API key in URL
            default:
                return baseHeaders;
        }
    }

    /**
     * Build request body based on provider
     */
    private getRequestBody(
        provider: string,
        prompt: string,
        model?: string,
        maxTokens?: number,
        temperature?: number
    ): any {
        switch (provider) {
            case 'openai':
                return {
                    model: model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens,
                    temperature,
                };
            case 'anthropic':
                return {
                    model: model || 'claude-3-haiku-20240307',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens || 1024,
                    temperature,
                };
            case 'gemini':
                return {
                    contents: [{ parts: [{ text: prompt }] }],
                };
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    /**
     * Extract response text based on provider
     */
    private extractResponse(provider: string, data: any): string {
        switch (provider) {
            case 'openai':
                return data.choices?.[0]?.message?.content || '';
            case 'anthropic':
                return data.content?.[0]?.text || '';
            case 'gemini':
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            default:
                return '';
        }
    }

    /**
     * Analyze article credibility
     */
    async analyzeCredibility(article: Article): Promise<CredibilityResult> {
        const prompt = `Analyze the credibility of this news article. Return ONLY a JSON object with this structure:
{
  "score": <number 0-100>,
  "level": "<high|medium|low>",
  "factors": {
    "sourceReliability": <number 0-100>,
    "factualAccuracy": <number 0-100>,
    "biasDetection": <number 0-100>
  },
  "highlights": [
    {
      "text": "<excerpt from article>",
      "isCredible": <boolean>,
      "reason": "<explanation>"
    }
  ],
  "summary": "<brief explanation of credibility assessment>"
}

Article Title: ${article.title}
Article Content: ${article.content.substring(0, 2000)}`;

        const response = await this.callAI(prompt);

        try {
            // Try to parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to parse credibility result:', error);
        }

        // Fallback result
        return {
            score: 50,
            level: 'medium',
            factors: {
                sourceReliability: 50,
                factualAccuracy: 50,
                biasDetection: 50,
            },
            highlights: [],
            summary: 'Unable to analyze credibility at this time.',
        };
    }

    /**
     * Generate article summary
     */
    async generateSummary(article: Article): Promise<SummaryResult> {
        const prompt = `Summarize this news article. Return ONLY a JSON object with this structure:
{
  "brief": "<2-3 sentence summary>",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3>"],
  "entities": [
    {
      "name": "<entity name>",
      "type": "<person|organization|location|technology|concept>"
    }
  ],
  "sentiment": "<positive|neutral|negative>",
  "readingTime": <number in minutes>
}

Article Title: ${article.title}
Article Content: ${article.content}`;

        const response = await this.callAI(prompt);

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to parse summary result:', error);
        }

        // Fallback result
        const wordCount = article.content.split(/\s+/).length;
        return {
            brief: article.summary || article.title,
            keyPoints: [],
            entities: [],
            sentiment: 'neutral',
            readingTime: Math.ceil(wordCount / 200),
        };
    }

    /**
     * Get personalized recommendations
     */
    async getRecommendations(articles: Article[], topics: string[]): Promise<Recommendation[]> {
        const articleTitles = articles.slice(0, 5).map(a => a.title).join(', ');

        const prompt = `Based on these saved articles and topics, recommend 5 relevant resources (articles, tutorials, videos). Return ONLY a JSON array:
[
  {
    "type": "<article|tutorial|resource|video>",
    "title": "<title>",
    "url": "<url>",
    "description": "<brief description>",
    "reason": "<why recommended>",
    "relevanceScore": <number 0-100>,
    "source": "<source name>"
  }
]

Saved Articles: ${articleTitles}
Topics of Interest: ${topics.join(', ')}`;

        const response = await this.callAI(prompt);

        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Failed to parse recommendations:', error);
        }

        return [];
    }

    /**
     * Generic content generation
     */
    async generateContent(prompt: string): Promise<string> {
        return this.callAI(prompt);
    }
}

/**
 * Create AI service instance
 */
export const createAIService = (config: AIConfig): AIService => {
    return new GenericAIService(config);
};
