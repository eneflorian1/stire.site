const Parser = require('rss-parser');

async function testRSS() {
    const parser = new Parser();
    try {
        const feed = await parser.parseURL('https://news.google.com/rss/search?q=Bitcoin&hl=ro-RO&gl=RO&ceid=RO:ro');
        console.log('Success!');
        console.log('Title:', feed.title);
        console.log('Items found:', feed.items.length);
        if (feed.items.length > 0) {
            console.log('First item:', feed.items[0].title);
            console.log('Link:', feed.items[0].link);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testRSS();
