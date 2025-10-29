
## VPS Details

- Domain: `stirix.site`
- IP (SSH_HOST): `64.225.49.128`
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
ssh-copy-id -i ~/.ssh/github_deploy_key.pub root@64.225.49.128

# If ssh-copy-id is not available (universal fallback)
scp %USERPROFILE%\.ssh\github_deploy_key.pub root@64.225.49.128:/root/github_deploy_key.pub
ssh root@64.225.49.128 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat ~/github_deploy_key.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm ~/github_deploy_key.pub"

# Test
ssh -i %USERPROFILE%\.ssh\github_deploy_key root@64.225.49.128 "echo OK"
```

## 1) Prepare VPS (initial setup + remove old project)

```bash
ssh root@64.225.49.128

# Backup and remove old project (adjust path if different)
OLD_DIR="/var/www/stirix.site"
if [ -d "$OLD_DIR" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  tar -C "$(dirname "$OLD_DIR")" -czf "/root/stirix.site.$TS.tgz" "$(basename "$OLD_DIR")"
  rm -rf "$OLD_DIR"
  echo "Old project removed. Backup: /root/stirix.site.$TS.tgz"
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
python3 -m venv /opt/app/.venv
/opt/app/.venv/bin/pip install --upgrade pip
/opt/app/.venv/bin/pip install -r /opt/app/server/requirements.txt
```

## 4) Systemd service (FastAPI via Uvicorn)

```bash
sudo cp ops/systemd/stirix.service /etc/systemd/system/stirix.service

# Use venv python for ExecStart
sudo sed -i 's|^ExecStart=.*|ExecStart=/opt/app/.venv/bin/python3 -m uvicorn app:app --host 127.0.0.1 --port 8000 --workers 2|' /etc/systemd/system/stirix.service

sudo systemctl daemon-reload
sudo systemctl enable stirix
sudo systemctl restart stirix
sudo systemctl status stirix --no-pager
```

## 5) Nginx reverse proxy (stirix.site → 127.0.0.1:8000)

```bash
sudo cp ops/nginx/stirix.site /etc/nginx/sites-available/stirix.site
sudo sed -i 's/server_name .*/server_name stirix.site www.stirix.site;/' /etc/nginx/sites-available/stirix.site
sudo ln -sf /etc/nginx/sites-available/stirix.site /etc/nginx/sites-enabled/stirix.site
sudo nginx -t && sudo systemctl reload nginx
```

Optional HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stirix.site -d www.stirix.site
```

## 6) GitHub Actions Secrets (Repo → Settings → Secrets and variables → Actions)

Add these secrets:

- `SSH_HOST` = `64.225.49.128`
- `SSH_USER` = `root`
- `SSH_PRIVATE_KEY` = contents of your private deploy key (generated at step 0)

To view the private key (Windows):

```bash
type %USERPROFILE%\.ssh\github_deploy_key
```

## 7) Deploy workflow

The repository already contains `.github/workflows/deploy.yml`. On push to `main`, it SSH-es into `64.225.49.128` and executes:

```bash
bash /opt/app/deploy.sh
```

## 8) Manual checks

```bash
# Trigger deploy manually
ssh root@64.225.49.128 'bash /opt/app/deploy.sh'

# Health check via Nginx
curl -fsS http://stirix.site/health || curl -fsS http://64.225.49.128/health || true
```

Notes:

- Do not store VPS passwords in the repository or in GitHub secrets. Use SSH keys.
- If you rename the service from `stirix`, update both `/etc/systemd/system/stirix.service` and `ops/deploy.sh`.
- Backend listens only on localhost; Nginx proxies external traffic.