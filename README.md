## stire.site Admin Dashboard

Aplicatie Next.js (App Router + Tailwind CSS) pentru redactia **stire.site**. Panoul permite introducerea articolelor, atasarea de categorii si imagini, gestionarea topicurilor si trimiterea automata catre Google Indexing API.

## Functionalitati principale

- Formular complet pentru titlu, categorie (`Articol/<categorie>/<slug>`), descriere, continut, status, data publicarii si imagine reprezentativa.
- Persistenta locala in `data/articles.json` (poate fi inlocuita ulterior cu o baza de date reala).
- Regenerarea automata a tuturor sitemap-urilor:
  - `sitemap.xml` (index) contine: `sitemap-news.xml`, `sitemap-articles-latest.xml`, `sitemap-categories.xml`, `sitemap-images.xml`.
  - Sitemap-urile de articole includ URL-urile in formatul cerut (`https://www.stire.site/Articol/economic/banca-mondiala...` in functie de `SITE_BASE_URL`).
  - Sitemap-ul de categorii expune rutele `Categorie/<slug>`, iar cel de imagini listeaza doar articolele cu URL de imagine.
- Integrare cu Google Indexing API prin `google-auth-library`. Daca lipseste credentialul din env, articolul ramane creat iar utilizatorul este informat ca trimiterea a fost sarita.

## Setup rapid

```bash
npm install
cp .env.example .env.local  # personalizeaza domeniul si credentialele
npm run dev
```

Aplicatia ruleaza pe [http://localhost:3000](http://localhost:3000).

### Variabile de mediu

- `SITE_BASE_URL` – domeniul public pentru URL-uri si sitemap-uri (ex: `https://www.stiri.site`).
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` – continutul JSON al service account-ului cu access la Indexing API (escape la `\n`).
- `GEMINI_API_KEY` este stocat encrypted in `data/gemini.json` prin dashboard (nu in env).

### Flux

1. **UI (src/components/admin-dashboard.tsx)** – taburi pentru Articole, Categorii, Topicuri, SMGoogle, Gemini si Anunturi.
2. **API (src/app/api/**)** – articole, categorii, topicuri (manual + import), loguri Google, banner si modul Gemini.
3. **Persistenta & SEO** – fisierele din `data/` (articles, categories, topics, smgoogle, gemini, banner) plus sitemap-urile din `public/`.

### Comenzi utile

- `npm run dev` – dezvoltare locala.
- `npm run build && npm run start` – productie / deploy.
- `npm run lint` – verificari ESLint.

Pentru resetarea datelor locale, sterge continutul `data/articles.json` si fisierele `public/sitemap*.xml` (vor fi recreate la urmatorul articol creat din dashboard).

## Deploy pe VPS

1. **Primul setup pe server** - cloneaza repo-ul pe VPS si ruleaza `bash setup.sh` cu utilizatorul care va rula aplicatia. Scriptul instaleaza Node.js 20.x, dependintele npm, configureaza un proces PM2 numit `stire-site` (ruleaza `npm run start -- --hostname 127.0.0.1 --port 3000`) si pregateste template-ul nginx din `ops/nginx/stire.site.conf`, astfel incat domeniul sa raspunda pe porturile 80/443 fara suffix `:3000`.
2. **Completeaza `.env.production`** pe server cu valorile reale pentru `SITE_BASE_URL` (ex: `https://www.stire.site`) si `GOOGLE_APPLICATION_CREDENTIALS_JSON`. JSON-ul service-account trebuie sa fie o singura linie cu `\n` escape pentru cheie, deoarece fisierul este folosit atat de Next.js cat si de systemd.
3. **Configureaza HTTPS** optional dupa setup: `sudo certbot --nginx -d domeniu -d www.domeniu` si decomenteaza blocul TLS din config daca vrei un fisier separat.
4. **Activeaza deploy automat** - dupa ce serverul este pregatit, configureaza secretele/variabilele GitHub (Settings -> Secrets and variables -> Actions):
   - `SSH_HOST` - IP/hostname al VPS-ului.
   - `SSH_USER` - utilizatorul cu acces SSH si permisiuni `sudo systemctl`.
   - `SSH_PRIVATE_KEY` - cheia privata OpenSSH (fara parola) pentru utilizatorul definit mai sus.
   - `SSH_PORT` *(optional)* - seteaza doar daca nu folosesti portul 22.
   - `PROJECT_DIR` *(optional, secret sau Actions variable)* - calea absoluta catre proiect pe server daca nu este `/opt/stire.site` (ex: `/opt/app/stire.site`).
   - `SITE_BASE_URL` - baza publica pentru URL-uri si sitemap-uri.
   - `GOOGLE_JSON` - continutul JSON pentru Google Indexing API (poti reutiliza `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`).

Pe fiecare push in `main`, workflow-ul `.github/workflows/deploy.yml` se conecteaza prin SSH, sincronizeaza `.env.production`, ruleaza `ops/deploy.sh` (git pull + `npm ci && npm run build`) si restarteaza serviciul `stire-site`. In cazul in care cheia JSON lipseste, API-ul de indexare nu mai este sarit deoarece secretul este injectat pe server la fiecare deploy.

> Nota: utilizatorul definit in `SSH_USER` trebuie sa poata rula `pm2` si comenzi `sudo systemctl reload nginx` fara parola. Verifica `pm2 status` dupa fiecare deploy; daca serverul a fost restartat, `pm2 resurrect` (automat prin `pm2 startup`) va reporni aplicatia.
     
