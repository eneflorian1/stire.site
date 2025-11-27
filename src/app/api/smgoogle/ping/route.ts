import { NextResponse } from 'next/server';

export async function GET() {
    const sitemapUrl = 'https://stire.site/sitemap.xml';
    const pingUrl = `http://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

    try {
        const response = await fetch(pingUrl);

        if (response.ok) {
            return NextResponse.json({
                message: `Sitemap pinged successfully: ${sitemapUrl}`
            });
        } else {
            const text = await response.text();
            return NextResponse.json(
                { message: `Failed to ping sitemap. Status: ${response.status}. Response: ${text}` },
                { status: response.status }
            );
        }
    } catch (error) {
        console.error('Error pinging sitemap', error);
        return NextResponse.json(
            { message: 'Error pinging sitemap', error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
