/**
 * Test script pentru verificarea functiei de filtrare stiri recente (max 3 zile)
 * 
 * Ruleaza cu: node test-news-filter.js
 */

// Simulare functie searchRecentNewsForTopic
const searchRecentNewsForTopic = async (query) => {
    try {
        const q = encodeURIComponent(query.trim());
        const url = `https://news.google.com/rss/search?q=${q}&hl=ro&gl=RO&ceid=RO:ro`;

        console.log(`\n🔍 Cautare stiri pentru: "${query}"`);
        console.log(`📡 URL: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
        });

        if (!response.ok) {
            console.log(`❌ Eroare HTTP: ${response.status}`);
            return false;
        }

        const xml = await response.text();
        console.log(`📄 XML primit: ${xml.length} caractere`);

        // Parseaza XML-ul pentru a gasi datele articolelor
        const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/gi;
        const dates = [];
        let match;

        while ((match = pubDateRegex.exec(xml)) !== null) {
            try {
                const dateStr = match[1];
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    dates.push(date);
                }
            } catch {
                // Ignora datele invalide
            }
        }

        console.log(`📅 Articole gasite: ${dates.length}`);

        if (dates.length === 0) {
            console.log(`⚠️  Nu s-au gasit articole`);
            return false;
        }

        // Verifica daca exista cel putin un articol din ultimele 3 zile
        const now = Date.now();
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

        const recentArticles = dates.filter((date) => {
            const articleAge = now - date.getTime();
            return articleAge <= THREE_DAYS && articleAge >= 0;
        });

        console.log(`\n📊 Statistici:`);
        console.log(`   Total articole: ${dates.length}`);
        console.log(`   Articole recente (max 3 zile): ${recentArticles.length}`);

        if (recentArticles.length > 0) {
            console.log(`\n✅ Gasit ${recentArticles.length} articol(e) recent(e):`);
            recentArticles.slice(0, 5).forEach((date, idx) => {
                const ageHours = Math.floor((now - date.getTime()) / (1000 * 60 * 60));
                console.log(`   ${idx + 1}. ${date.toLocaleString('ro-RO')} (acum ${ageHours}h)`);
            });
            return true;
        } else {
            console.log(`\n❌ Nu exista articole recente (max 3 zile)`);
            if (dates.length > 0) {
                const oldestRecent = dates[0];
                const ageHours = Math.floor((now - oldestRecent.getTime()) / (1000 * 60 * 60));
                console.log(`   Cel mai recent articol: ${oldestRecent.toLocaleString('ro-RO')} (acum ${ageHours}h)`);
            }
            return false;
        }
    } catch (error) {
        console.log(`\n💥 Eroare: ${error.message}`);
        return false;
    }
};

// Teste
const testTopics = [
    'Alegeri Romania 2024',
    'Fotbal Liga 1',
    'Vremea Bucuresti',
    'Politica Romania',
    'Tehnologie AI',
];

const runTests = async () => {
    console.log('🚀 Testare functie searchRecentNewsForTopic');
    console.log('='.repeat(60));

    for (const topic of testTopics) {
        const hasRecentNews = await searchRecentNewsForTopic(topic);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Rezultat final pentru "${topic}": ${hasRecentNews ? '✅ ARE stiri recente' : '❌ NU ARE stiri recente'}`);
        console.log(`${'='.repeat(60)}\n`);

        // Pauza intre cereri pentru a nu suprasolicita serverul
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Teste finalizate!');
};

runTests().catch(console.error);
