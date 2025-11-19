// Test to find JSON data in Google Trends page
const fs = require('fs');

async function findJsonData() {
    const GOOGLE_TRENDS_URL = 'https://trends.google.com/trending?geo=RO';

    const response = await fetch(GOOGLE_TRENDS_URL, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
        },
    });

    const html = await response.text();

    // Save HTML to file for inspection
    fs.writeFileSync('trends_page.html', html);
    console.log('Saved HTML to trends_page.html');

    // Look for entityNames pattern
    const entityPattern = /entityNames":\s*\["([^"]+)"\]/g;
    const entityMatches = [...html.matchAll(entityPattern)];
    console.log('\nFound', entityMatches.length, 'entityNames matches');
    if (entityMatches.length > 0) {
        console.log('First 10 entityNames:');
        entityMatches.slice(0, 10).forEach((m, i) => console.log(`${i + 1}. ${m[1]}`));
    }

    // Look for title pattern in JSON
    const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
    const titleMatches = [...html.matchAll(titlePattern)];
    console.log('\nFound', titleMatches.length, 'title matches');
    if (titleMatches.length > 0) {
        console.log('First 20 titles:');
        titleMatches.slice(0, 20).forEach((m, i) => console.log(`${i + 1}. ${m[1]}`));
    }
}

findJsonData().catch(console.error);
