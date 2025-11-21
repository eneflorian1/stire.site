import Parser from 'rss-parser';
import { randomUUID } from 'crypto';

export interface ExternalArticle {
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    snippet: string;
}

export class ExternalSearchService {
    private parser: Parser;

    constructor() {
        this.parser = new Parser();
    }

    async search(query: string, domain?: string): Promise<ExternalArticle[]> {
        try {
            // Construct Google News RSS URL
            // hl=ro-RO&gl=RO&ceid=RO:ro ensures Romanian news
            const encodedQuery = encodeURIComponent(query + (domain ? ` ${domain}` : ''));
            const feedUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=ro-RO&gl=RO&ceid=RO:ro`;

            const feed = await this.parser.parseURL(feedUrl);

            if (!feed.items || feed.items.length === 0) {
                return [];
            }

            // Map RSS items to ExternalArticle
            return feed.items.slice(0, 5).map(item => {
                // Google News RSS content often contains HTML with links, we want plain text snippet if possible
                // But usually 'contentSnippet' or 'content' is available.
                // The 'source' is often in the title "Title - Source" or in a specific field if parsed well.

                // Extract source from title if possible (Format: "Title - Source Name")
                let title = item.title || 'No title';
                let source = 'Google News';
                const lastDashIndex = title.lastIndexOf(' - ');
                if (lastDashIndex > 0) {
                    source = title.substring(lastDashIndex + 3);
                    title = title.substring(0, lastDashIndex);
                }

                return {
                    id: randomUUID(),
                    title: title,
                    url: item.link || '',
                    source: source,
                    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    snippet: item.contentSnippet || item.content || title // Fallback to title if no snippet
                };
            });

        } catch (error) {
            console.error('Error fetching Google News RSS:', error);
            return [];
        }
    }
}

export const externalSearchService = new ExternalSearchService();
