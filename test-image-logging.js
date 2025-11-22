/**
 * Script de test pentru verificarea logurilor detaliate de imagine
 * 
 * Ruleaza cu: node test-image-logging.js
 */

// Simulare constante
const MIN_IMAGE_WIDTH = 600;
const MIN_IMAGE_HEIGHT = 315;

// Simulare functie searchImageForTopic cu logging
const searchImageForTopic = async (query, logger) => {
    const log = logger ?? (() => { });

    try {
        const q = encodeURIComponent(query.trim());
        const url = `https://www.google.com/search?q=${q}&tbm=isch&hl=ro&gl=RO`;

        log(`🔍 Cautare imagine pentru: "${query}"`);

        const response = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
            },
        });

        if (!response.ok) {
            log(`❌ Eroare HTTP la cautare imagine: ${response.status}`);
            return null;
        }

        const html = await response.text();
        log(`📄 HTML primit: ${html.length} caractere`);

        const regex = /https:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/gi;
        const candidates = [];
        let match;

        while ((match = regex.exec(html)) !== null) {
            const candidate = match[0];
            if (!candidate.toLowerCase().includes('gstatic')) {
                candidates.push(candidate);
            }
            if (candidates.length >= 5) break;
        }

        log(`🖼️  Imagini candidate gasite: ${candidates.length}`);
        if (candidates.length > 0) {
            log(`✅ Prima imagine: ${candidates[0].substring(0, 80)}...`);
        } else {
            log(`⚠️  Nu s-au gasit imagini candidate`);
        }

        return candidates[0] ?? null;
    } catch (error) {
        log(`💥 Eroare la cautare imagine: ${error.message}`);
        return null;
    }
};

// Simulare functie downloadImageToUploads cu logging
const downloadImageToUploads = async (remoteUrl, nameHint, logger) => {
    const log = logger ?? (() => { });

    try {
        log(`📥 Incercare download imagine: ${remoteUrl.substring(0, 80)}...`);

        const response = await fetch(remoteUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                Referer: 'https://www.google.com/',
            },
        });

        if (!response.ok) {
            log(`❌ Eroare HTTP la download imagine: ${response.status} ${response.statusText}`);
            return null;
        }

        log(`✅ Raspuns HTTP: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const bytes = Buffer.from(arrayBuffer);
        const sizeKB = Math.round(bytes.length / 1024);

        log(`📦 Dimensiune fisier: ${sizeKB} KB`);

        if (!bytes.length) {
            log(`❌ Fisier gol (0 bytes)`);
            return null;
        }

        if (bytes.length > 10 * 1024 * 1024) {
            log(`❌ Fisier prea mare: ${sizeKB} KB (max 10 MB)`);
            return null;
        }

        // Simulare verificare dimensiuni (in realitate folosim image-size package)
        // Pentru test, presupunem dimensiuni random
        const width = Math.floor(Math.random() * 2000) + 100;
        const height = Math.floor(Math.random() * 1500) + 100;

        log(`📐 Rezolutie imagine: ${width}x${height}px`);

        if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) {
            log(`❌ Rezolutie prea mica: ${width}x${height}px (minim: ${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}px)`);
            return null;
        }

        log(`✅ Rezolutie acceptabila`);

        const filename = `${nameHint.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
        const publicUrl = `/uploads/${filename}`;

        log(`💾 Salvare imagine: ${filename}`);
        log(`✅ Imagine salvata cu succes: ${publicUrl}`);

        return {
            imageUrl: publicUrl,
            sourceUrl: remoteUrl,
        };
    } catch (error) {
        log(`💥 Eroare la download/salvare imagine: ${error.message}`);
        return null;
    }
};

// Test complet proces imagine
const testImageProcess = async (topic) => {
    console.log('\n' + '='.repeat(80));
    console.log(`🧪 TEST: "${topic}"`);
    console.log('='.repeat(80));

    const imageLogs = [];
    const imageLogger = (msg) => {
        imageLogs.push(msg);
        console.log(`  ${msg}`);
    };

    let imageUrl;
    let imageSourceUrl;

    imageLogger(`🎨 Incepere proces cautare imagine pentru topic: "${topic}"`);

    try {
        const remoteUrl = await searchImageForTopic(topic, imageLogger);

        if (remoteUrl) {
            imageSourceUrl = remoteUrl;
            imageLogger(`✅ URL imagine gasit, incercare download...`);

            const downloaded = await downloadImageToUploads(remoteUrl, topic, imageLogger);

            if (downloaded) {
                imageUrl = downloaded.imageUrl;
                imageSourceUrl = downloaded.sourceUrl;
                imageLogger(`🎉 Proces imagine finalizat cu succes!`);
            } else {
                imageLogger(`⚠️  Download imagine esuat (verificati logurile de mai sus pentru detalii)`);
            }
        } else {
            imageLogger(`⚠️  Nu s-a gasit niciun URL de imagine`);
        }
    } catch (error) {
        imageLogger(`💥 Eroare neasteptata la procesare imagine: ${error.message}`);
    }

    const imageLogSummary = imageLogs.join('\n');

    console.log('\n' + '-'.repeat(80));
    console.log('📋 REZUMAT LOG FINAL:');
    console.log('-'.repeat(80));

    if (imageUrl) {
        console.log(`✅ Status: SUCCES - Imagine salvata`);
        console.log(`📸 URL imagine: ${imageUrl}`);
    } else {
        console.log(`⚠️  Status: ESEC - Articol fara imagine`);
    }

    console.log('\n--- Loguri complete ---');
    console.log(imageLogSummary);
    console.log('='.repeat(80));
};

// Ruleaza teste
const runTests = async () => {
    console.log('🚀 TESTARE SISTEM LOGURI IMAGINE GEMINI');
    console.log('='.repeat(80));

    const testTopics = [
        'Politica Romania',
        'Fotbal Liga 1',
        'Tehnologie AI',
    ];

    for (const topic of testTopics) {
        await testImageProcess(topic);
        // Pauza intre teste
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ TOATE TESTELE FINALIZATE!');
};

runTests().catch(console.error);
