# Production Deploy (VPS) via GitHub Actions + SSH

This guide sets up automatic deploys to your VPS on every push to `main`.

## 1) Prepare VPS

```bash
# Create target dir and clone repo
sudo mkdir -p /opt/app
sudo chown -R $USER:$USER /opt/app
cd /opt/app
git clone git@github.com:ORG/REPO.git .   # or https://... if preferred
```

Create the deploy script and make it executable:

```bash
sudo nano /opt/app/deploy.sh
```

Paste the contents from `ops/deploy.sh`, then:

```bash
sudo chmod +x /opt/app/deploy.sh
```

## 2) Systemd service (FastAPI via Uvicorn)

Create `/etc/systemd/system/stirix.service` from `ops/systemd/stirix.service` and adjust:

- `User=YOUR_USER`
- `ExecStart` python path (use venv if available)
- `Environment=API_KEY=prodkey` change to a real value if needed

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stirix
sudo systemctl start stirix
sudo systemctl status stirix
```

## 3) Nginx reverse proxy

Copy `ops/nginx/stirix.site` to `/etc/nginx/sites-available/stirix.site`, edit `server_name` if needed:

```bash
sudo ln -s /etc/nginx/sites-available/stirix.site /etc/nginx/sites-enabled/stirix.site
sudo nginx -t
sudo systemctl reload nginx
```

Optional HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stirix.site -d www.stirix.site
```

## 4) GitHub Actions Secrets (Repo → Settings → Secrets and variables → Actions)

Add these secrets:

- `SSH_HOST` = VPS IP or hostname (e.g., `185.104.183.59`)
- `SSH_USER` = VPS user (e.g., `root` or `ubuntu`)
- `SSH_PRIVATE_KEY` = contents of your private deploy key

Generate a dedicated deploy key locally and authorize it on the VPS:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy_key -N ""
ssh-copy-id -i ~/.ssh/github_deploy_key.pub SSH_USER@SSH_HOST
# Copy contents of ~/.ssh/github_deploy_key into the GitHub secret SSH_PRIVATE_KEY
```

## 5) Deploy flow

On push to `main`, GitHub Actions runs `.github/workflows/deploy.yml` which SSH-es into the VPS and executes:

```bash
bash /opt/app/deploy.sh
```

That script performs `git fetch/reset/pull` and restarts the systemd service. If Docker Compose is present, it re-pulls and redeploys containers.

## Notes

- Do not store VPS passwords in the repository or in GitHub secrets. Prefer SSH keys.
- If your service name is not `stirix`, update both the unit file and `ops/deploy.sh` accordingly.
- Backend runs on `127.0.0.1:8000`. Nginx proxies external traffic to it.


