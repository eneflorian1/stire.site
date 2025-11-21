
import { externalSearchService } from './src/lib/external-search';

async function test() {
    console.log('Testing RSS fetch...');
    const articles = await externalSearchService.search('Romania');

    console.log(`Found ${articles.length} articles.`);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    console.log('Three days ago:', threeDaysAgo.toISOString());

    articles.forEach(a => {
        console.log('--------------------------------');
        console.log('Title:', a.title);
        console.log('Published Raw:', a.publishedAt);
        const pubDate = new Date(a.publishedAt);
        console.log('Parsed Date:', pubDate.toISOString());
        console.log('Is Recent:', pubDate >= threeDaysAgo);
    });
}

test();
