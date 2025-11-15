Stire Frontend (React + Vite + TypeScript)

Acest frontend este destinat pentru desktop/web. Pentru mobile (aplicație și browser), folosiți build-ul Flutter din `app/`.

Setup rapid:
- Node 18+
- Backend FastAPI pornit (vezi `server/app.py`)

Comenzi:
```bash
cd frontend
npm install
npm run dev
```

Variabile (opțional): creați `.env` cu:
- `VITE_API_BASE_URL` (implicit `http://localhost:8000`)
- `VITE_API_KEY` (implicit `devkey`)
- `VITE_MOBILE_URL` – dacă vrei ca redirecționarea pentru ecrane mici să meargă către un server mobil diferit (ex. Flutter dev server: `http://localhost:55086/`). Dacă nu este setat, se folosește `VITE_API_BASE_URL + /mobile/` (servit de FastAPI dacă există build Flutter web).

Rute:
- `/` listează articole, tab-uri categorii, căutare
- `/create` creează articol (POST `/articles`)

Legături backend:
- `GET /categories`
- `GET /articles?category=...&q=...`
- `POST /articles` (antet `x-api-key`)


