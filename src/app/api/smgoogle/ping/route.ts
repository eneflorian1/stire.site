import { NextResponse } from 'next/server';

export async function GET() {
    const sitemaps = [
        'https://stire.site/sitemap-news.xml',
        'https://stire.site/sitemap-articles-latest.xml',
    ];

    const results = await Promise.all(
        sitemaps.map(async (sitemapUrl) => {
            const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
            try {
                const response = await fetch(pingUrl);
                return {
                    sitemap: sitemapUrl,
                    pingUrl,
                    status: response.status,
                    ok: response.ok,
                };
            } catch (error) {
                return {
                    sitemap: sitemapUrl,
                    pingUrl,
                    status: 0,
                    ok: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        })
    );

    const allOk = results.every((r) => r.ok);

    if (!allOk) {
        return NextResponse.json(
            { message: 'Some pings failed', results },
            { status: 500 }
        );
    }

    return NextResponse.json({ message: 'All sitemaps pinged successfully', results });
}
