import { NextResponse } from 'next/server';
import { submitBatchSMGoogle, getSMGoogleLogs } from '@/lib/smgoogle';

export async function GET() {
    const sitemaps = [
        'https://stire.site/sitemap-news.xml',
        'https://stire.site/sitemap-articles-latest.xml',
    ];

    const allUrls = new Set<string>();

    // 1. Fetch Sitemaps and extract URLs
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

    const sitemapUrls = Array.from(allUrls).map(url => {
        let normalized = url.replace(/^https?:\/\/www\./, (match) => match.replace('www.', ''));
        if (normalized.startsWith('http://')) {
            normalized = normalized.replace('http://', 'https://');
        }
        return normalized;
    });

    if (sitemapUrls.length === 0) {
        return NextResponse.json({ message: 'Nu s-au gasit URL-uri in sitemap-uri.', results: [] });
    }

    // 2. Filter out URLs that have already been successfully submitted
    const logs = await getSMGoogleLogs();
    const submittedUrls = new Set(
        logs
            .filter(log => log.status === 'success')
            .map(log => log.url)
    );

    const newUrls = sitemapUrls.filter(url => !submittedUrls.has(url));

    if (newUrls.length === 0) {
        return NextResponse.json({
            message: 'Toate URL-urile din sitemap au fost deja trimise la Google Indexing.',
            results: []
        });
    }

    // 3. Submit only new URLs
    // Limit to 50 to avoid hitting quotas too hard in one go
    const limitedUrls = newUrls.slice(0, 50);

    try {
        const results = await submitBatchSMGoogle(limitedUrls);
        const failures = results.filter(r => !r.submission.success && !r.submission.skipped);
        const successCount = results.filter(r => r.submission.success).length;
        const skippedCount = results.filter(r => r.submission.skipped).length;

        const message = `S-au procesat ${results.length} link-uri noi: ${successCount} trimise cu succes, ${skippedCount} sarite, ${failures.length} erori. (Total in sitemap: ${sitemapUrls.length}, Deja trimise: ${submittedUrls.size})`;

        return NextResponse.json({
            message,
            results
        });
    } catch (error) {
        console.error('Error in batch submission', error);
        return NextResponse.json(
            { message: 'Eroare la trimiterea catre Google Indexing API', error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
