
## VPS Details

- Domain: `stire.site`
- IP (SSH_HOST): `206.189.10.234`
- SSH user (SSH_USER): `root`
- App dir: `/opt/app`
- Systemd service: `stirix.service`
- Backend bind: `127.0.0.1:8000` (proxied by Nginx)

## 0) Create SSH deploy key (Windows)

Generate a keypair locally and authorize it on the VPS.

```bash
# Generate key (Windows CMD/PowerShell)
ssh-keygen -t ed25519 -C "github-deploy" -f %USERPROFILE%\.ssh\github_deploy_key -N ""

# Add PUBLIC key to VPS (Git Bash with ssh-copy-id)
ssh-copy-id -i ~/.ssh/github_deploy_key.pub root@206.189.10.234

# If ssh-copy-id is not available (universal fallback)
scp %USERPROFILE%\.ssh\github_deploy_key.pub root@206.189.10.234:/root/github_deploy_key.pub
ssh root@6206.189.10.234 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat ~/github_deploy_key.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm ~/github_deploy_key.pub"

# Test
ssh -i %USERPROFILE%\.ssh\github_deploy_key root@206.189.10.234 "echo OK"
```

## 1) Prepare VPS (initial setup + remove old project)

```bash
ssh root@206.189.10.234

# Backup and remove old project (adjust path if different)
OLD_DIR="/var/www/stire.site"
if [ -d "$OLD_DIR" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  tar -C "$(dirname "$OLD_DIR")" -czf "/root/stire.site.$TS.tgz" "$(basename "$OLD_DIR")"
  rm -rf "$OLD_DIR"
  echo "Old project removed. Backup: /root/stire.site.$TS.tgz"
fi

# Create target dir
sudo mkdir -p /opt/app
sudo chown -R $USER:$USER /opt/app
cd /opt/app

# Clone your repository (replace ORG/REPO accordingly)
git clone git@github.com:ORG/REPO.git .   # or use https:// if preferred
```

## 2) Deploy script on VPS

```bash
# Copy the deploy script from repo and make it executable
sudo install -m 0755 ops/deploy.sh /opt/app/deploy.sh
```

Script behavior: `git fetch/reset/pull`, then optionally Docker Compose, then restarts `stirix.service` if present.

## 3) Python venv + dependencies

```bash
# Recomandat: venv în folderul server (fără punct), așa cum ai configurat deja:
python3 -m venv /opt/app/server/venv
/opt/app/server/venv/bin/pip install --upgrade pip
/opt/app/server/venv/bin/pip install -r /opt/app/server/requirements.txt
```

## 4) Systemd service (FastAPI via Uvicorn)

```bash
sudo cp ops/systemd/stirix.service /etc/systemd/system/stire.site.service

# Editează user-ul din service (YOUR_USER) în root sau user-ul tău
sudo sed -i "s|^User=YOUR_USER|User=root|" /etc/systemd/system/stire.site.service

sudo systemctl daemon-reload
sudo systemctl enable stire.site
sudo systemctl restart stire.site
sudo systemctl status stire.site --no-pager
```

## 5) Nginx reverse proxy (stire.site → 127.0.0.1:8000)

```bash
sudo cp ops/nginx/stire.site /etc/nginx/sites-available/stire.site
sudo sed -i 's/server_name .*/server_name stire.site www.stire.site;/' /etc/nginx/sites-available/stire.site
sudo ln -sf /etc/nginx/sites-available/stire.site /etc/nginx/sites-enabled/stire.site
sudo nginx -t && sudo systemctl reload nginx
```

Optional HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stire.site -d www.stire.site
```

## 6) GitHub Actions Secrets (Repo → Settings → Secrets and variables → Actions)

Add these secrets:

- `SSH_HOST` = `206.189.10.234` (IP-ul serverului VPS)
- `SSH_USER` = `root` (utilizatorul SSH)
- `SSH_PRIVATE_KEY` = conținutul cheii private de deploy (generată la pasul 0)
- `PROJECT_DIR` = (opțional) calea către folderul proiectului pe server (ex: `/opt/app` sau `/home/user/stire.site`)

**Notă:** Dacă `PROJECT_DIR` nu este setat, workflow-ul va detecta automat folderul proiectului căutând `setup.sh` sau `ecosystem.config.js` în locații comune (`/opt/app`, `/home/user/stirix`, etc.).

To view the private key (Windows):

```bash
type %USERPROFILE%\.ssh\github_deploy_key
```

## 7) Deploy workflow

Repository-ul conține deja `.github/workflows/deploy.yml`. La push pe branch-ul `main`, workflow-ul:

1. Se conectează la serverul VPS via SSH
2. Detectează automat folderul proiectului (folosind același mecanism ca `setup.sh`) sau folosește `PROJECT_DIR` secret dacă este setat
3. Rulează `ops/deploy.sh` în folderul detectat

Workflow-ul rulează automat la fiecare push pe `main` și execută:

```bash
bash <PROJECT_DIR>/ops/deploy.sh <PROJECT_DIR>
```

Unde `<PROJECT_DIR>` este folderul detectat automat sau cel setat în secret-ul `PROJECT_DIR`.

## 8) Manual checks

```bash
# Trigger deploy manually
ssh root@206.189.10.234 'bash /opt/app/deploy.sh'

# Health check via Nginx
curl -fsS http://stire.site/health || curl -fsS http://206.189.10.234/health || true
```

Notes:

- Do not store VPS passwords in the repository or in GitHub secrets. Use SSH keys.
- If you rename the service from `stirix`, update both `/etc/systemd/system/stirix.service` and `ops/deploy.sh`.
- Backend listens only on localhost; Nginx proxies external traffic.