// Test script to debug Google Trends scraping
async function testTrendsExtraction() {
    const GOOGLE_TRENDS_URL = 'https://trends.google.com/trending?geo=RO';

    const response = await fetch(GOOGLE_TRENDS_URL, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        cache: 'no-store',
    });

    const html = await response.text();

    console.log('Response status:', response.status);
    console.log('HTML length:', html.length);

    // Save a snippet to see what we got
    console.log('\n--- First 2000 chars of HTML ---');
    console.log(html.substring(0, 2000));

    // Try to find script tags with data
    const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    console.log('\n--- Found', scriptMatches.length, 'script tags ---');

    // Look for JSON-like data
    for (let i = 0; i < Math.min(5, scriptMatches.length); i++) {
        const scriptContent = scriptMatches[i][1];
        if (scriptContent.includes('title') || scriptContent.includes('trend')) {
            console.log(`\n--- Script ${i} (first 500 chars) ---`);
            console.log(scriptContent.substring(0, 500));
        }
    }

    // Try the patterns
    const patterns = [
        /"title":"([^"]+)"/gi,
        /entityNames":\s*\["([^"]+)"\]/gi,
    ];

    console.log('\n--- Testing patterns ---');
    for (const pattern of patterns) {
        const matches = [...html.matchAll(pattern)];
        console.log(`Pattern ${pattern} found ${matches.length} matches`);
        if (matches.length > 0) {
            console.log('First 5 matches:', matches.slice(0, 5).map(m => m[1]));
        }
    }
}

testTrendsExtraction().catch(console.error);
