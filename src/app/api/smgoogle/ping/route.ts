import { NextResponse } from 'next/server';
import { submitBatchSMGoogle } from '@/lib/smgoogle';

export async function GET() {
    const sitemaps = [
        'https://stire.site/sitemap-news.xml',
        'https://stire.site/sitemap-articles-latest.xml',
    ];

    const allUrls = new Set<string>();

    await Promise.all(
        sitemaps.map(async (sitemapUrl) => {
            try {
                const response = await fetch(sitemapUrl, { next: { revalidate: 0 } });
                if (!response.ok) {
                    console.error(`Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
                    return;
                }
                const text = await response.text();
                const matches = text.matchAll(/<loc>(.*?)<\/loc>/g);
                for (const match of matches) {
                    if (match[1]) allUrls.add(match[1]);
                }
            } catch (error) {
                console.error(`Failed to fetch sitemap ${sitemapUrl}`, error);
            }
        })
    );

    const urls = Array.from(allUrls).map(url => {
        let normalized = url.replace(/^https?:\/\/www\./, (match) => match.replace('www.', ''));
        if (normalized.startsWith('http://')) {
            normalized = normalized.replace('http://', 'https://');
        }
        return normalized;
    });

    if (urls.length === 0) {
        return NextResponse.json({ message: 'No URLs found in sitemaps', results: [] });
    }

    // Limit to 50 most recent URLs (assuming sitemaps are ordered or we just take first 50)
    // Sitemaps usually have newest first or last?
    // If we want to ensure we get the latest, we might need to trust the sitemap order.
    // We'll take the first 50 found.
    const limitedUrls = urls.slice(0, 50);

    try {
        const results = await submitBatchSMGoogle(limitedUrls);
        const failures = results.filter(r => !r.submission.success && !r.submission.skipped);
        const successCount = results.filter(r => r.submission.success).length;
        const skippedCount = results.filter(r => r.submission.skipped).length;

        const message = `Processed ${results.length} URLs: ${successCount} sent, ${skippedCount} skipped, ${failures.length} failed.`;

        return NextResponse.json({
            message,
            results
        });
    } catch (error) {
        console.error('Error in batch submission', error);
        return NextResponse.json(
            { message: 'Error submitting URLs to Google Indexing API', error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
