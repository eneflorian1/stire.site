(async () => {
  const landing = await fetch('https://consent.google.com/s?continue=https://trends.google.com/trends/trendingsearches/daily?geo=RO&hl=ro&gl=RO&pc=srp&uxe=none&hl=ro&src=1', {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const consentCookie = 'CONSENT=YES+cb.20210720-07-p0.ro+F+494';
  const page = await fetch('https://trends.google.com/trends/trendingsearches/daily?geo=RO&hl=ro', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': consentCookie }
  });
  const rawCookie = page.headers.get('set-cookie');
  const cookieParts = [consentCookie];
  if (rawCookie) {
    cookieParts.push(rawCookie.split(';')[0]);
  }
  const cookie = cookieParts.join('; ');
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const qs = new URLSearchParams({ hl: 'ro', tz: '-120', geo: 'RO', cat: 'all', ed: `${yyyy}${mm}${dd}`, ns: '15' });
  const url = `https://trends.google.com/trends/api/dailytrends?${qs.toString()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json, text/plain, */*',
      'Cookie': cookie,
      'Referer': 'https://trends.google.com/trends/trendingsearches/daily?geo=RO',
      'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8'
    }
  });
  console.log(res.status, res.statusText);
  const text = await res.text();
  console.log(text.slice(0, 200));
})();
