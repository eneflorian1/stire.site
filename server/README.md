

## Instalare (Windows / macOS / Linux)
```bash
cd server
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
```

## Rulare
```bash
uvicorn app:app --reload --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

La primul start, baza de date `news.db` (SQLite) este creată automat și populată cu câteva articole demo.

## Configurare
Variabile de mediu suportate:
- `DATABASE_URL` (default: `sqlite:///./news.db`)
- `API_KEY` (default: `devkey`) — folosit pentru rutele de scriere (POST/PUT/DELETE) în header-ul `X-API-Key`.

## Endpoint-uri
- `GET /health` — status
- `GET /categories` — listă categorii ("Toate" + distinct)
- `GET /articles` — listare cu parametri: `category`, `q`, `offset`, `limit`
- `GET /articles/{id}` — articol după id
- `POST /articles` — creare (necesită `X-API-Key`)
- `PUT /articles/{id}` — actualizare (necesită `X-API-Key`)
- `DELETE /articles/{id}` — ștergere (necesită `X-API-Key`)

## Docker (opțional)
```bash
# din directorul server/
docker build -t stirix-api .
docker run -p 8000:8000 --env API_KEY=devkey --name stirix-api stirix-api
```

## Integrare Flutter (scurt)
- Înlocuiește lista mock cu fetch din `GET /articles`.
- Pentru web/mobile, CORS este deja configurat permisiv pentru dev.
