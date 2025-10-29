    pip install -r server/requirements.txt
    ```
  - Pornește serverul:
    ```bash
    uvicorn app:app --reload --port 8000
    ```

- Flutter:
  - Ia dependențele:
    ```bash
    flutter pub get
    ```
  - Rulează aplicația (emulator/dispozitiv):
    ```bash
    flutter run
    ```

- Acces:
  - Din aplicația Flutter, apasă iconița Admin din `AppBar` ca să intri în dashboard.
  - Direct în browser: `http://localhost:8000/admin`

- Note:
  - Dashboard-ul folosește baza de date configurată (`server/news.db` sau `DATABASE_URL`).
  - Operațiile de creare/editare/ștergere din dashboard nu cer `x-api-key` (se fac direct la nivelul serverului în aceeași aplicație).

- **Fișiere cheie modificate/adiționate**:
  - `server/app.py` (rute admin + Jinja2)
  - `server/templates/admin/base.html`
  - `server/templates/admin/index.html`
  - `server/templates/admin/form.html`
  - `server/requirements.txt` (noi dependențe)
  - `app/pubspec.yaml` (url_launcher)
  - `app/lib/main.dart` (buton Admin + lansare URL)

Toate sarcinile sunt bifate.