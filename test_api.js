// Script simplu pentru a trimite manual un URL la Google Indexing API.
// Rulare: node test_api.js https://stire.site/Articol/...
//
// Folosește direct fișierul de service account ai-news-412315-eb00799918a1.json
// din rădăcina proiectului.

const fs = require('fs').promises;
const path = require('path');
const { JWT } = require('google-auth-library');

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

async function loadCredentials() {
  const serviceAccountPath = path.join(
    __dirname,
    'ai-news-412315-eb00799918a1.json'
  );
  try {
    const raw = await fs.readFile(serviceAccountPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Nu pot citi fișierul de credențiale ${serviceAccountPath}. Asigură-te că există și conține JSON valid.\n` +
        (err && err.message ? err.message : '')
    );
  }
}

async function submitUrl(url) {
  const credentials = await loadCredentials();

  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [INDEXING_SCOPE],
  });

  const { access_token } = await client.authorize();
  if (!access_token) {
    throw new Error('Nu am putut obține access_token de la Google.');
  }

  const response = await fetch(INDEXING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      url,
      type: 'URL_UPDATED',
    }),
  });

  const body = await response.json().catch(() => ({}));

  console.log('--- Google Indexing API ---');
  console.log('URL trimis: ', url);
  console.log('Status HTTP:', response.status, response.statusText);
  console.log('Răspuns JSON:');
  console.log(JSON.stringify(body, null, 2));
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node test_api.js https://exemplu.ro/cale/catre/pagina');
    process.exit(1);
  }

  try {
    await submitUrl(url);
  } catch (err) {
    console.error('Eroare la trimiterea către Google Indexing API:');
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
