// Test google-trends-api library
const googleTrends = require('google-trends-api');

async function testGoogleTrendsAPI() {
    try {
        console.log('Testing google-trends-api library...\n');

        // Get daily trends for Romania
        const results = await googleTrends.dailyTrends({
            geo: 'RO',
        });

        const data = JSON.parse(results);
        console.log('Success! Got data from Google Trends API');
        console.log('\nNumber of trending searches:', data.default?.trendingSearchesDays?.[0]?.trendingSearches?.length || 0);

        if (data.default?.trendingSearchesDays?.[0]?.trendingSearches) {
            console.log('\nFirst 10 trending topics:');
            const trends = data.default.trendingSearchesDays[0].trendingSearches.slice(0, 10);
            trends.forEach((trend, i) => {
                console.log(`${i + 1}. ${trend.title.query}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testGoogleTrendsAPI();
