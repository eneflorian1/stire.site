import { normalizeAllArticlesAndRebuildSitemaps } from '@/lib/articles';

async function main() {
  try {
    const result = await normalizeAllArticlesAndRebuildSitemaps();
    console.log(`[sitemaps] Rebuilt successfully. Normalized articles: ${result.normalized}`);
  } catch (error) {
    console.error('[sitemaps] Failed to rebuild sitemaps', error);
    process.exit(1);
  }
}

main();

