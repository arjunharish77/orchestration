# VPS to Go-Live Runbook: Unnatify CRM

This is the beginner-friendly production runbook for taking Unnatify CRM from a fresh VPS to a live deployment.

It covers the operational steps only: VPS setup, DNS, security, Docker, environment values, production wiring, deployment, Nginx, SSL, backups, restore checks, health checks, queue checks, and go-live validation.

It does not include application source-code instructions.

---

## 0. Final Production Assumptions

Use these assumptions unless the project context is changed later.

| Area | Decision |
| --- | --- |
| VPS | Hostinger KVM VPS |
| OS | Ubuntu 22.04 LTS or Ubuntu 24.04 LTS |
| Frontend domain | `app.unnatify.com` |
| API domain | `api.unnatify.com` |
| Reverse proxy | Nginx |
| SSL | Certbot / Let's Encrypt |
| Runtime | Docker Compose |
| Database | PostgreSQL |
| Queue/cache | Redis |
| Backend | NestJS |
| ORM/migrations | Prisma |
| Upload format | CSV only |
| Login | Email/password first, provision for email OTP |
| Provider | MCUBE for WhatsApp, voicebot, and telephony |
| Fixed roles | Administrator, Sales Manager, Sales User |
| Branch/Partner model | Configurable Teams |
| Default automation | None. All journeys are admin-configured. |

Important placeholders used in this document:

```txt
YOUR_SERVER_IP
YOUR_REPOSITORY_URL
YOUR_EMAIL
USE_A_STRONG_PASSWORD
USE_A_LONG_RANDOM_SECRET
```

---

## 1. What Must Exist Before Deployment

Where: Project planning / local development.

Before the VPS deployment can work, the project must provide these deployment pieces:

1. A Docker Compose production setup.
2. Container build configuration for frontend.
3. Container build configuration for backend.
4. Container build configuration for workers.
5. A frontend service.
6. A backend API service.
7. A worker service.
8. A PostgreSQL service.
9. A Redis service.
10. Persistent database storage.
11. Persistent Redis storage if Redis persistence is enabled.
12. Mounted upload storage.
13. Mounted log storage if file logs are used.
14. A production environment file.
15. An example environment template for required variables.
16. A database migration command.
17. A backend health endpoint.
18. A worker/queue verification method.
19. A backup command or script.
20. A restore procedure.

Required container build files:

```txt
frontend/Dockerfile
backend/Dockerfile
workers/Dockerfile
```

Do not run `docker compose build` until all three exist. Compose can define the services correctly, but builds will fail if the service build files are missing.

Minimum expected service names:

```txt
frontend
backend
workers
postgres
redis
```

Minimum expected internal ports:

```txt
frontend: 3000
backend: 4000
postgres: 5432, internal only
redis: 6379, internal only
```

If the project uses different frontend or backend ports, update the Nginx proxy section before going live.

Never expose these publicly:

```txt
PostgreSQL 5432
Redis 6379
BullMQ dashboard
Database admin tools
```

Only these should be public:

```txt
80
443
SSH port, normally 22
```

---

## 2. Required Production Wiring Contract

Where: Project deployment configuration.

The deployment must follow this wiring:

```txt
Internet
  |
  | HTTPS
  |
Nginx on VPS
  |
  | app.unnatify.com -> frontend container, port 3000
  | api.unnatify.com -> backend container, port 4000
  |
Docker Compose network
  |
  | backend -> postgres:5432
  | backend -> redis:6379
  | workers -> postgres:5432
  | workers -> redis:6379
```

Persistent storage must exist for:

```txt
PostgreSQL data
Redis data, if appendonly/persistence is enabled
Uploads
Reports
Backups
Logs, if stored as files
```

Production folders on the VPS should be:

```txt
/opt/unnatify-crm
/opt/unnatify-crm/uploads
/opt/unnatify-crm/uploads/leads
/opt/unnatify-crm/uploads/documents
/opt/unnatify-crm/uploads/reports
/opt/unnatify-crm/logs
/opt/unnatify-crm/backups
/opt/unnatify-crm/backups/postgres
```

Critical warning:

```txt
Do not delete Docker volumes unless you intentionally want to wipe production data.
Do not run docker compose down -v in production.
Do not run docker volume prune on the production VPS.
```

---

## 3. Buy and Prepare the VPS

Where: Hostinger dashboard.

1. Buy a Hostinger KVM VPS.
2. Select Ubuntu 22.04 LTS or Ubuntu 24.04 LTS.
3. Set a strong root password or add your SSH key.
4. Note the VPS public IP address.

Example:

```txt
YOUR_SERVER_IP=123.123.123.123
```

---

## 4. Point DNS to the VPS

Where: Domain DNS panel.

Create these records:

```txt
Type: A
Name: app
Value: YOUR_SERVER_IP
TTL: 300 or Automatic
```

```txt
Type: A
Name: api
Value: YOUR_SERVER_IP
TTL: 300 or Automatic
```

Where: Your local computer terminal.

Check DNS:

```bash
nslookup app.unnatify.com
nslookup api.unnatify.com
```

Optional:

```bash
ping app.unnatify.com
ping api.unnatify.com
```

DNS can take a few minutes to several hours depending on the provider.

---

## 5. Connect to the VPS for the First Time

Where: Your local computer terminal.

```bash
ssh root@YOUR_SERVER_IP
```

If asked to trust the server:

```txt
yes
```

---

## 6. Update the VPS

Where: VPS terminal as `root`.

```bash
apt update
apt upgrade -y
reboot
```

After reboot, reconnect:

```bash
ssh root@YOUR_SERVER_IP
```

---

## 7. Create a Deploy User

Where: VPS terminal as `root`.

```bash
adduser deploy
usermod -aG sudo deploy
```

Copy root SSH keys to deploy user:

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Where: Your local computer terminal.

Test deploy login:

```bash
ssh deploy@YOUR_SERVER_IP
```

From this point onward, use `deploy` for normal server work.

---

## 8. Basic Server Security

Where: VPS terminal as `deploy`.

Install firewall and brute-force protection:

```bash
sudo apt install -y ufw fail2ban
```

Allow SSH, HTTP, and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```

Enable Fail2ban:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo systemctl status fail2ban
```

Recommended after confirming deploy SSH works:

```bash
sudo nano /etc/ssh/sshd_config
```

Set:

```txt
PermitRootLogin no
PasswordAuthentication no
```

Restart SSH:

```bash
sudo systemctl restart ssh
```

Important:

```txt
Keep your current SSH session open.
Open a second terminal and test deploy login before closing the first session.
```

---

## 9. Install Base Packages

Where: VPS terminal as `deploy`.

```bash
sudo apt install -y ca-certificates curl gnupg git nginx unzip htop ncdu jq
```

Check Nginx:

```bash
sudo systemctl status nginx
```

---

## 10. Install Docker and Docker Compose

Where: VPS terminal as `deploy`.

Install Docker using Docker's official Ubuntu repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

Add Docker repository:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install Docker:

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Allow deploy user to run Docker:

```bash
sudo usermod -aG docker deploy
```

Log out and log back in:

```bash
exit
ssh deploy@YOUR_SERVER_IP
```

Test Docker:

```bash
docker --version
docker compose version
docker ps
```

---

## 11. Create Production Folders

Where: VPS terminal as `deploy`.

```bash
sudo mkdir -p /opt/unnatify-crm/uploads/leads
sudo mkdir -p /opt/unnatify-crm/uploads/documents
sudo mkdir -p /opt/unnatify-crm/uploads/reports
sudo mkdir -p /opt/unnatify-crm/logs
sudo mkdir -p /opt/unnatify-crm/backups/postgres
sudo chown -R deploy:deploy /opt/unnatify-crm
```

Check:

```bash
ls -la /opt/unnatify-crm
```

---

## 12. Set Up Source Control

Where: GitHub/GitLab/Bitbucket in browser.

1. Create a private repository.
2. Keep secrets out of the repository.
3. Use `main` as the production branch unless another branch is selected.

Where: Local computer terminal, inside the local project folder.

```bash
git init
git add .
git commit -m "Initial project setup"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Where: VPS terminal as `deploy`.

```bash
cd /opt
git clone YOUR_REPOSITORY_URL unnatify-crm
cd /opt/unnatify-crm
```

If the folder already exists:

```bash
cd /opt/unnatify-crm
git pull origin main
```

---

## 13. Production Environment Values

Where: VPS terminal as `deploy`, inside `/opt/unnatify-crm`.

Create production environment file:

```bash
nano .env
```

Minimum values:

```txt
NODE_ENV=production

POSTGRES_DB=unnatify_crm
POSTGRES_USER=unnatify_user
POSTGRES_PASSWORD=USE_A_STRONG_PASSWORD
DATABASE_URL=postgresql://unnatify_user:USE_A_STRONG_PASSWORD@postgres:5432/unnatify_crm

REDIS_URL=redis://redis:6379

JWT_SECRET=USE_A_LONG_RANDOM_SECRET

APP_URL=https://app.unnatify.com
API_URL=https://api.unnatify.com

UPLOADS_DIR=/app/uploads
LOG_LEVEL=info

EMAIL_OTP_ENABLED=false
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# Connector provider URLs, tokens, API keys, and webhook secrets are configured
# inside Settings > Connectors, not in the VPS environment file.
```

Generate strong secrets:

```bash
openssl rand -base64 48
```

Secure the file:

```bash
chmod 600 .env
```

Check:

```bash
ls -l .env
```

Expected permission should look like:

```txt
-rw-------
```

---

## 14. Required Docker Compose Behavior

Where: Project deployment configuration.

The Compose setup must satisfy this checklist before production deployment:

```txt
frontend service exists
backend service exists
workers service exists
postgres service exists
redis service exists
frontend listens internally on port 3000
backend listens internally on port 4000
postgres is not published publicly
redis is not published publicly
backend can reach postgres using hostname postgres
backend can reach redis using hostname redis
workers can reach postgres using hostname postgres
workers can reach redis using hostname redis
uploads folder is mounted persistently
postgres data is stored in a named volume or persistent host path
redis data is stored in a named volume or persistent host path if persistence is enabled
environment values are read from the production env file
containers restart automatically unless stopped
```

Recommended Redis runtime settings:

```txt
appendonly yes
maxmemory 1gb
maxmemory-policy allkeys-lru
```

Redis memory should be adjusted based on VPS RAM.

For smaller VPS plans, use:

```txt
maxmemory 512mb
```

For Hostinger KVM 4, `1gb` is a reasonable starting point if the app load is moderate.

Important:

```txt
The exact Compose configuration must match the Nginx proxy ports.
If frontend is not on 3000 or backend is not on 4000, update Nginx before enabling SSL.
```

---

## 15. Production Docker Compose Reference

This section gives a concrete production reference for the Compose setup.

Use this as the baseline when the project deployment configuration is created. Adjust build paths, service commands, and healthcheck paths only if the actual project setup requires it.

Before creating or validating Compose, confirm the required container build files exist:

```bash
cd /opt/unnatify-crm
ls -l frontend/Dockerfile backend/Dockerfile workers/Dockerfile
```

If any file is missing, stop here and create the missing container build configuration before continuing.

Important:

```txt
Frontend and backend ports are bound to 127.0.0.1 only.
This lets Nginx reach them from the VPS, but avoids exposing them directly to the public internet.

PostgreSQL and Redis do not publish ports.
They are reachable only by containers on the Docker network.
```

Reference Compose configuration:

```yaml
services:
  frontend:
    build:
      context: ./frontend
    container_name: unnatify_frontend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
    container_name: unnatify_backend
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "127.0.0.1:4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - /opt/unnatify-crm/uploads:/app/uploads
      - /opt/unnatify-crm/logs:/app/logs

  workers:
    build:
      context: ./workers
    container_name: unnatify_workers
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - /opt/unnatify-crm/uploads:/app/uploads
      - /opt/unnatify-crm/logs:/app/logs

  postgres:
    image: postgres:16
    container_name: unnatify_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    container_name: unnatify_redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

After creating or changing the Compose configuration, validate it:

```bash
cd /opt/unnatify-crm
docker compose config
```

Do not continue until this command succeeds.

Restart policy note:

```txt
restart: unless-stopped is intentional.
It means containers restart after crashes and reboots, but if you manually stop a service, Docker respects that manual stop.

restart: always is also acceptable for critical production services, but it can restart containers even after manual stops. Use unless-stopped unless there is a specific operational reason to change it.
```

Security expectation:

```txt
Port 3000 should listen on 127.0.0.1 only.
Port 4000 should listen on 127.0.0.1 only.
Port 5432 should not be public.
Port 6379 should not be public.
```

---

## 16. Build and Start Containers

Where: VPS terminal as `deploy`, inside `/opt/unnatify-crm`.

Build:

```bash
docker compose build
```

Start:

```bash
docker compose up -d
```

Check containers:

```bash
docker compose ps
```

Check logs:

```bash
docker compose logs --tail=100
```

Verify port exposure:

```bash
sudo ss -tulpn
```

Expected:

```txt
Port 3000 should listen on 127.0.0.1 only.
Port 4000 should listen on 127.0.0.1 only.
Port 5432 should not listen publicly.
Port 6379 should not listen publicly.
```

Follow logs:

```bash
docker compose logs -f
```

Stop following logs:

```txt
Ctrl + C
```

---

## 17. Run Database Migrations

Where: VPS terminal as `deploy`, inside `/opt/unnatify-crm`.

Run migrations:

```bash
docker compose exec backend npx prisma migrate deploy
```

If the project provides seed data for roles, Administrator user, and System user:

```bash
docker compose exec backend npm run seed
```

Check PostgreSQL access:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

If your shell does not have these variables loaded, use the real values:

```bash
docker compose exec postgres psql -U unnatify_user -d unnatify_crm
```

Inside PostgreSQL:

```sql
\dt
```

Exit:

```sql
\q
```

---

## 18. Required Health Endpoints

Where: Backend API behavior.

The backend should expose these production health endpoints:

```txt
GET /health
GET /health/db
GET /health/redis
```

Expected meanings:

```txt
/health       API process is running
/health/db    API can connect to PostgreSQL
/health/redis API can connect to Redis
```

Where: VPS terminal as `deploy`, before Nginx is configured.

If backend port `4000` is exposed only locally:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/health/db
curl http://127.0.0.1:4000/health/redis
```

After Nginx and SSL:

```bash
curl https://api.unnatify.com/health
curl https://api.unnatify.com/health/db
curl https://api.unnatify.com/health/redis
```

Do not go live until health checks pass.

---

## 19. Worker and Queue Verification

Where: VPS terminal as `deploy`, inside `/opt/unnatify-crm`.

Check worker logs:

```bash
docker compose logs --tail=100 workers
```

Confirm the worker container is running:

```bash
docker compose ps workers
```

The project should provide a safe queue smoke test before production.

Expected queue smoke test behavior:

```txt
1. Add one harmless test job.
2. Worker picks the job.
3. Worker marks the job completed.
4. No failed jobs remain.
```

Use the project-provided queue smoke command when available:

```bash
docker compose exec backend npm run queue:smoke
```

Then check worker logs again:

```bash
docker compose logs --tail=100 workers
```

If there is an admin queue viewer later, check:

```txt
waiting jobs
active jobs
completed jobs
failed jobs
delayed jobs
```

Do not go live with failed worker startup, Redis connection errors, or repeated failed jobs.

---

## 20. Configure Nginx

Where: VPS terminal as `deploy`.

Before editing Nginx, verify the application ports:

```bash
cd /opt/unnatify-crm
docker compose ps
```

The Nginx config below assumes:

```txt
frontend -> 127.0.0.1:3000
backend  -> 127.0.0.1:4000
```

If your Compose setup uses different published local ports, change Nginx accordingly.

CSV upload note:

```txt
Nginx is configured below with client_max_body_size 25M.
The backend upload/parser limit should also allow at least the same size, otherwise large CSV uploads may pass Nginx but fail inside the API.
```

Create config:

```bash
sudo nano /etc/nginx/sites-available/unnatify-crm
```

Add:

```nginx
server {
    listen 80;
    server_name app.unnatify.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.unnatify.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/unnatify-crm /etc/nginx/sites-enabled/unnatify-crm
```

Remove default site if not needed:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

Test:

```bash
sudo nginx -t
```

Reload:

```bash
sudo systemctl reload nginx
```

Check HTTP before SSL:

```bash
curl -I http://app.unnatify.com
curl -I http://api.unnatify.com
curl http://api.unnatify.com/health
```

---

## 21. Install Certbot and Add SSL

There are two common Certbot install methods. Use one.

### Option A: Apt Method

Where: VPS terminal as `deploy`.

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificates:

```bash
sudo certbot --nginx -d app.unnatify.com -d api.unnatify.com
```

### Option B: Snap Method

Where: VPS terminal as `deploy`.

Certbot commonly recommends Snap for many Linux setups.

```bash
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

Issue certificates:

```bash
sudo certbot --nginx -d app.unnatify.com -d api.unnatify.com
```

When prompted:

```txt
Enter your email.
Agree to terms.
Choose redirect HTTP to HTTPS.
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

Check certificates:

```bash
sudo certbot certificates
```

---

## 22. Verify HTTPS

Where: Your local computer browser.

Open:

```txt
https://app.unnatify.com
https://api.unnatify.com/health
```

Where: VPS terminal as `deploy`.

```bash
curl -I https://app.unnatify.com
curl https://api.unnatify.com/health
curl https://api.unnatify.com/health/db
curl https://api.unnatify.com/health/redis
```

Expected:

```txt
Frontend loads over HTTPS.
API health returns success.
DB health returns success.
Redis health returns success.
```

---

## 23. Create First Administrator and System User

Where: Browser or VPS terminal, depending on available setup method.

Required production users:

```txt
First human Administrator user
System user for automation, workers, integrations, and scheduled jobs
```

If the project provides a seed command:

```bash
cd /opt/unnatify-crm
docker compose exec backend npm run seed
```

After seeding, log in:

```txt
https://app.unnatify.com
```

Confirm:

```txt
Administrator can log in.
Administrator role exists.
Sales Manager role exists.
Sales User role exists.
System user exists.
Teams can be configured.
```

---

## 24. Safe Database Access

Where: VPS terminal as `deploy`.

Access PostgreSQL only through the container or private Docker network:

```bash
cd /opt/unnatify-crm
docker compose exec postgres psql -U unnatify_user -d unnatify_crm
```

Useful PostgreSQL commands:

```sql
\dt
\du
\l
\q
```

Do not open port `5432` publicly.

Optional future DB viewer rules:

```txt
Admin-only access
Read-only by default
Whitelisted tables only
No arbitrary SQL editor in browser
No public access
```

Optional pgAdmin rule:

```txt
Only use behind admin-only authentication, VPN, or SSH tunnel.
Do not expose pgAdmin publicly.
```

---

## 25. Configure PostgreSQL Backups

Where: VPS terminal as `deploy`.

Create backup folder:

```bash
mkdir -p /opt/unnatify-crm/backups/postgres
```

Manual backup test:

```bash
cd /opt/unnatify-crm
docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/unnatify-crm/backups/postgres/backup_$(date +%Y%m%d_%H%M%S).sql
```

Check backup:

```bash
ls -lh /opt/unnatify-crm/backups/postgres
```

Check backup file is not empty:

```bash
du -h /opt/unnatify-crm/backups/postgres/*.sql
```

Add daily cron:

```bash
crontab -e
```

Add:

```cron
0 2 * * * cd /opt/unnatify-crm && docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/unnatify-crm/backups/postgres/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql
30 2 * * * find /opt/unnatify-crm/backups/postgres -type f -name "*.sql" -mtime +7 -delete
```

Check cron:

```bash
crontab -l
```

Important:

```txt
Daily local PostgreSQL backups are still required.
Hostinger weekly VPS backups will be used initially as the disaster recovery backup.
If production data becomes critical, add a daily off-server database backup copy later.
```

Optional future off-server backup options:

```txt
Another VPS
S3-compatible object storage
Backblaze B2
Google Drive or another secure cloud storage account
Managed backup service from the VPS provider
```

Minimum go-live rule:

```txt
Daily local PostgreSQL backup must work.
Hostinger weekly VPS backup should be enabled.
Off-server daily DB copy is a later hardening step unless stricter production requirements are introduced.
```

Example off-server copy using `rsync` to another server:

```bash
rsync -avz /opt/unnatify-crm/backups/postgres/ backup-user@BACKUP_SERVER_IP:/backups/unnatify-crm/postgres/
```

If using object storage, use the provider's CLI or backup tool and test both upload and restore before relying on it.

---

## 26. Restore Test Procedure

Where: VPS terminal as `deploy`.

Do not restore over production unless you intentionally want to replace production data.

For a restore drill, use a temporary test database.

Create a test database:

```bash
cd /opt/unnatify-crm
docker compose exec postgres createdb -U unnatify_user unnatify_restore_test
```

Restore latest backup into test database:

```bash
LATEST_BACKUP=$(ls -t /opt/unnatify-crm/backups/postgres/*.sql | head -1)
docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d unnatify_restore_test' < "$LATEST_BACKUP"
```

Check tables:

```bash
docker compose exec postgres psql -U unnatify_user -d unnatify_restore_test -c '\dt'
```

Drop test database after verification:

```bash
docker compose exec postgres dropdb -U unnatify_user unnatify_restore_test
```

Recommended schedule:

```txt
Run a restore drill once per month.
Run a restore drill before major production launches.
```

---

## 27. Configure Docker Log Rotation

Where: VPS terminal as `deploy`.

Create Docker daemon config:

```bash
sudo nano /etc/docker/daemon.json
```

Add:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

Restart Docker:

```bash
sudo systemctl restart docker
```

Start app again:

```bash
cd /opt/unnatify-crm
docker compose up -d
```

Check:

```bash
docker compose ps
```

---

## 28. Configure Swap

Where: VPS terminal as `deploy`.

Check memory:

```bash
free -h
```

If swap does not exist, create 2 GB swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

Make permanent:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Check:

```bash
free -h
```

---

## 29. Configure MCUBE Later

Where: VPS terminal as `deploy`, inside `/opt/unnatify-crm`.

Do this only after MCUBE technical documents and credentials are available.

Edit environment:

```bash
nano .env
```

Fill connector settings in the app UI after deploy:

- Settings > Connectors > Telephony: provider URL/body and webhook secret
- Settings > Connectors > WhatsApp: Meta credentials, verify token, webhook secret, templates, and numbers
- Settings > Connectors > Voicebot: webhook secret, execution toggle, triggers, and mappings

Restart:

```bash
docker compose up -d
```

Expected webhook categories:

```txt
WhatsApp events
Voicebot events
Telephony/click-to-call events
```

Final webhook URLs must match the implemented backend routes. Do not send URLs to MCUBE until routes are confirmed.

Likely public URL pattern:

```txt
https://api.unnatify.com/webhooks/mcube/whatsapp
https://api.unnatify.com/webhooks/mcube/voicebot
https://api.unnatify.com/webhooks/mcube/telephony
```

Before enabling live MCUBE traffic:

```txt
Webhook signature validation works.
Raw webhook payloads are stored.
Normalized events are visible in lead timeline.
Failed webhook logs are visible to admins/ops.
Retries are understood.
Opt-out / DND behavior is confirmed.
```

---

## 30. Configure Email OTP Later

Where: VPS terminal as `deploy`, inside `/opt/unnatify-crm`.

Edit environment:

```bash
nano .env
```

Fill SMTP values:

```txt
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EMAIL_OTP_ENABLED=true
```

Restart:

```bash
docker compose up -d
```

Test:

```txt
User requests OTP.
Email arrives.
OTP expires correctly.
Wrong OTP is rejected.
Rate limiting works.
```

---

## 31. Deployment Process for Future Updates

Where: Local computer terminal, inside local project folder.

Before deployment:

```bash
git status
git add .
git commit -m "Describe the change"
git push origin main
```

Where: VPS terminal as `deploy`.

```bash
cd /opt/unnatify-crm
git pull origin main
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose ps
```

Check health:

```bash
curl https://api.unnatify.com/health
curl https://api.unnatify.com/health/db
curl https://api.unnatify.com/health/redis
```

Check logs:

```bash
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 workers
```

Run queue smoke test if available:

```bash
docker compose exec backend npm run queue:smoke
```

---

## 32. Rollback Plan

Where: VPS terminal as `deploy`.

If a deployment fails before migrations:

```bash
cd /opt/unnatify-crm
git log --oneline -5
git checkout PREVIOUS_COMMIT_HASH
docker compose build
docker compose up -d
```

If migrations already ran:

```txt
Do not blindly roll back code.
Check whether the database schema changed.
Use a tested restore only if you intentionally want to revert data.
```

Before risky deployments:

```bash
cd /opt/unnatify-crm
docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/unnatify-crm/backups/postgres/pre_deploy_$(date +%Y%m%d_%H%M%S).sql
```

---

## 33. Release Tagging and Source-Control Checklist

Where: local machine first, then VPS.

Before deploying to production, commit the exact code that will go live:

```bash
git status
git add .
git commit -m "Release production CRM build"
git tag -a vYYYY.MM.DD-unnatify-crm -m "Unnatify CRM production release"
git push origin main
git push origin vYYYY.MM.DD-unnatify-crm
```

On the VPS, deploy only from the pushed branch or tag:

```bash
cd /opt/unnatify-crm
git fetch --all --tags
git checkout vYYYY.MM.DD-unnatify-crm
```

Confirm before continuing:

```bash
git status
git rev-parse --short HEAD
git describe --tags --always
```

Keep the previous production commit/tag noted in the deployment notes so rollback has a clear target.

---

## 34. Production Migration Checklist

Where: local machine first, then VPS.

Before running migrations on production:

```bash
npm run typecheck -w backend
npm run typecheck -w frontend
```

Review migration files locally before deployment:

```bash
ls backend/prisma/migrations
git diff -- backend/prisma/schema.prisma backend/prisma/migrations
```

Do not continue if a migration drops a table, drops a column, truncates data, or rewrites large production tables unless that operation was intentionally planned and a restore point exists.

Create a fresh pre-migration backup on the VPS:

```bash
cd /opt/unnatify-crm
mkdir -p /opt/unnatify-crm/backups/postgres
docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/unnatify-crm/backups/postgres/pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

Run migrations only after the backup succeeds:

```bash
docker compose exec backend npx prisma migrate deploy
```

Validate after migration:

```bash
docker compose exec backend npx prisma migrate status
curl -s http://127.0.0.1:4000/health/db
```

---

## 33. Go-Live Health Checklist

Where: Browser.

Check:

```txt
https://app.unnatify.com
https://api.unnatify.com/health
```

Where: VPS terminal as `deploy`.

```bash
cd /opt/unnatify-crm
docker compose ps
curl https://api.unnatify.com/health
curl https://api.unnatify.com/health/db
curl https://api.unnatify.com/health/redis
docker compose logs --tail=50 backend
docker compose logs --tail=50 workers
df -h
free -h
sudo ss -tulpn
sudo systemctl status nginx
sudo ufw status
```

Expected:

```txt
All containers are running.
Frontend loads.
API health passes.
Database health passes.
Redis health passes.
Login works.
Worker is running.
Queue smoke test passes.
No repeated backend errors.
No repeated worker errors.
Disk has enough free space.
Memory is stable.
Nginx is active.
Firewall allows only required public ports.
Ports 3000 and 4000 are bound to 127.0.0.1 only.
PostgreSQL and Redis are not exposed publicly.
```

---

## 34. Production Readiness Checklist

Before real users access the CRM:

```txt
DNS points correctly.
SSL works for frontend and API.
Frontend, backend, and worker container build files exist.
Compose config validates successfully.
Email/password login works.
Administrator user exists.
System user exists.
Administrator, Sales Manager, and Sales User roles exist.
Teams can be configured.
CSV upload is tested.
Uploaded files persist after container restart.
PostgreSQL data persists after container restart.
Redis does not exceed memory cap.
PostgreSQL is not public.
Redis is not public.
Ports 3000 and 4000 are local-only.
Nginx exposes only frontend/API.
Nginx upload size is configured for CSV uploads.
Nginx proxy timeouts are configured for API/webhook traffic.
Daily local PostgreSQL backup works.
Hostinger weekly VPS backup is enabled.
Restore drill has been tested.
Docker log rotation is enabled.
Health endpoints pass.
Worker queue smoke test passes.
MCUBE is disabled or in test mode until credentials are ready.
No default automation workflow is active.
Admin-created automation is tested before production use.
```

---

## 35. Common Troubleshooting Commands

Where: VPS terminal as `deploy`.

Containers:

```bash
cd /opt/unnatify-crm
docker compose ps
docker compose logs --tail=100
```

Backend logs:

```bash
docker compose logs -f backend
```

Frontend logs:

```bash
docker compose logs -f frontend
```

Worker logs:

```bash
docker compose logs -f workers
```

PostgreSQL logs:

```bash
docker compose logs -f postgres
```

Redis logs:

```bash
docker compose logs -f redis
```

Restart all containers:

```bash
docker compose up -d
```

Restart one service:

```bash
docker compose restart backend
docker compose restart workers
```

Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx
```

Ports:

```bash
sudo ss -tulpn
```

Disk:

```bash
df -h
sudo ncdu /
```

Memory:

```bash
free -h
htop
```

SSL:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

Firewall:

```bash
sudo ufw status
```

Database:

```bash
docker compose exec postgres psql -U unnatify_user -d unnatify_crm
```

Redis:

```bash
docker compose exec redis redis-cli ping
docker compose exec redis redis-cli info memory
```

---

## 36. Things You Should Not Do

Do not:

```txt
Expose PostgreSQL publicly.
Expose Redis publicly.
Expose BullMQ dashboard publicly.
Expose pgAdmin publicly.
Commit .env or secrets to Git.
Run production without SSL.
Run docker compose down -v in production.
Run docker volume prune in production.
Delete upload folders without backup.
Skip backup before major deployment.
Hardcode a default automation journey.
Enable MCUBE production webhooks before testing.
Give non-admin users access to logs, DB viewer, or ops pages.
Use root user for normal deployments.
```

---

## 37. Full Go-Live Order

Follow this order from fresh VPS to production:

1. Buy VPS.
2. Install Ubuntu.
3. Point `app.unnatify.com` and `api.unnatify.com` DNS to VPS IP.
4. SSH into VPS as root.
5. Update server.
6. Create `deploy` user.
7. Confirm `deploy` SSH works.
8. Secure SSH.
9. Enable firewall.
10. Install base packages.
11. Install Docker and Docker Compose.
12. Create production folders.
13. Push project to private Git repository.
14. Clone project to `/opt/unnatify-crm`.
15. Create production `.env`.
16. Confirm Compose service names, ports, volumes, Redis settings, and Postgres persistence.
17. Confirm frontend, backend, and worker container build files exist.
18. Create the production Compose configuration using the reference section.
19. Run `docker compose config`.
20. Fix any Compose validation errors.
21. Build containers.
22. Start containers.
23. Confirm containers are running.
24. Confirm ports 3000 and 4000 are bound to `127.0.0.1` only.
25. Run database migrations.
26. Seed Administrator/System users if supported.
27. Confirm backend health locally.
28. Confirm worker starts.
29. Run queue smoke test if available.
30. Configure Nginx with upload size and proxy timeout settings.
31. Confirm HTTP proxy works.
32. Install Certbot.
33. Issue SSL certificates.
34. Confirm HTTPS works.
35. Confirm `/health`, `/health/db`, and `/health/redis`.
36. Test login.
37. Test CSV upload.
38. Confirm uploaded files persist after restart.
39. Configure database backups.
40. Run manual backup.
41. Confirm Hostinger weekly VPS backup is enabled.
42. Run restore drill.
43. Configure Docker log rotation.
44. Configure swap if needed.
45. Confirm PostgreSQL and Redis are not public.
46. Keep MCUBE disabled until credentials and docs are ready.
47. Keep default automation empty.
48. Complete production readiness checklist.
49. Go live.

---

## 38. Final Production Service Reference

Use these stable service names when checking logs, migrations, queues, and backups:

```txt
frontend  -> local port 127.0.0.1:3000
backend   -> local port 127.0.0.1:4000
workers   -> no public port
postgres  -> local port 127.0.0.1:5432 only
redis     -> local port 127.0.0.1:6379 only
```

Required production env keys:

```bash
APP_URL=https://app.unnatify.com
API_URL=https://api.unnatify.com
JWT_SECRET=change-this-long-random-value
JWT_REFRESH_SECRET=change-this-second-long-random-value
POSTGRES_DB=unnatify_crm
POSTGRES_USER=unnatify_user
POSTGRES_PASSWORD=change-this-db-password
DATABASE_URL=postgresql://unnatify_user:change-this-db-password@postgres:5432/unnatify_crm
REDIS_URL=redis://redis:6379
UPLOAD_DIR=/app/uploads/lead-csv
RESEND_API_KEY=your-production-resend-key
RESEND_FROM_EMAIL=info@unnatify.com
```

Never commit the production `.env`.

---

## 39. Nginx Reference

Create API config:

```bash
sudo nano /etc/nginx/sites-available/api.unnatify.com
```

Use:

```nginx
server {
    server_name api.unnatify.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Create app config:

```bash
sudo nano /etc/nginx/sites-available/app.unnatify.com
```

Use:

```nginx
server {
    server_name app.unnatify.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/api.unnatify.com /etc/nginx/sites-enabled/api.unnatify.com
sudo ln -s /etc/nginx/sites-available/app.unnatify.com /etc/nginx/sites-enabled/app.unnatify.com
sudo nginx -t
sudo systemctl reload nginx
```

Issue SSL:

```bash
sudo certbot --nginx -d app.unnatify.com -d api.unnatify.com
sudo certbot renew --dry-run
```

---

## 40. Deployment Smoke Test Checklist

Run on VPS:

```bash
docker compose ps
sudo ss -tulpn
curl -s http://127.0.0.1:4000/health
curl -s http://127.0.0.1:4000/health/db
curl -s http://127.0.0.1:4000/health/redis
curl -s http://127.0.0.1:4000/health/workers
curl -I https://app.unnatify.com
curl -s https://api.unnatify.com/health
```

Confirm:

```txt
3000 is bound to 127.0.0.1 only.
4000 is bound to 127.0.0.1 only.
5432 is not public.
6379 is not public.
Workers show fresh heartbeats.
CSV upload works.
Lead list loads.
Login works.
Telephony webhook reference URLs show api.unnatify.com.
```

---

## 41. Off-Server Backup and Restore Drill

Hostinger weekly VPS backups are useful, but keep application backups too before real production data.

Manual DB backup:

```bash
mkdir -p /opt/unnatify-crm/backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "/opt/unnatify-crm/backups/unnatify-$(date +%F-%H%M).sql"
```

Copy backup off the VPS:

```bash
rsync -avz /opt/unnatify-crm/backups/ deploy@your-backup-server:/backups/unnatify-crm/
rsync -avz /opt/unnatify-crm/uploads/ deploy@your-backup-server:/backups/unnatify-crm/uploads/
```

Restore test on a non-production machine:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backup-file.sql
```

Do one restore drill before go-live and repeat monthly.

---

## 42. Production Release Checklist

Run these commands on your local machine before pushing a release:

```bash
npm ci
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
docker compose config --quiet
docker compose build
```

Run these commands on the VPS before applying a new release:

```bash
cd /opt/unnatify-crm/app
docker compose ps
curl -s http://127.0.0.1:4000/health
curl -s http://127.0.0.1:4000/health/db
curl -s http://127.0.0.1:4000/health/redis
curl -s http://127.0.0.1:4000/health/workers
```

Take a pre-migration backup:

```bash
mkdir -p /opt/unnatify-crm/backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "/opt/unnatify-crm/backups/pre-release-$(date +%F-%H%M).sql"
```

Pull and deploy:

```bash
cd /opt/unnatify-crm/app
git pull
docker compose build
docker compose run --rm backend npm run prisma:deploy
docker compose up -d
```

Post-deploy checks:

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 workers
curl -s http://127.0.0.1:4000/health/metrics
curl -s https://api.unnatify.com/health
curl -I https://app.unnatify.com
```

Functional smoke checks in browser:

```txt
Login works.
Dashboard loads without console errors.
Lead list loads and field selector works.
CSV upload creates an upload history row.
Activities list loads by activity type URL.
Settings pages load and create/edit dialogs open.
Telephony connector reference URLs show api.unnatify.com.
Reports overview loads and report export history updates.
```

Queue/worker checks:

```bash
curl -s http://127.0.0.1:4000/health/workers
curl -s http://127.0.0.1:4000/health/metrics
docker compose logs --tail=200 workers
```

Rollback commands:

```bash
cd /opt/unnatify-crm/app
git log --oneline -5
git checkout <previous-good-commit>
docker compose build
docker compose up -d
```

Only restore the database backup if the migration changed data incorrectly and you intentionally want to revert database state:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < /opt/unnatify-crm/backups/pre-release-YYYY-MM-DD-HHMM.sql
```

Never delete Docker volumes during rollback unless you intentionally want to wipe production data.

---

## 43. Disaster Recovery Targets

Recommended production targets:

```txt
RPO: 24 hours maximum data loss with daily app backups. Tighten to 4 hours once real production volume grows.
RTO: 4 hours to restore service on a replacement VPS.
Backup retention: 30 daily DB backups, 12 monthly DB backups, and matching upload/report file backups.
Restore drill: monthly on a non-production machine.
Secrets rotation: immediately after any suspected leak, otherwise every 90 days for JWT, Resend, MCUBE, database, and ops credentials.
```

Minimum backup set:

```txt
Postgres dump.
Uploaded files directory.
Generated report files.
.env values stored in a password manager, not only on the VPS.
Docker compose file and deployment runbook.
```

Recovery on a replacement VPS:

```bash
sudo mkdir -p /opt/unnatify-crm/app /opt/unnatify-crm/uploads /opt/unnatify-crm/logs /opt/unnatify-crm/backups
cd /opt/unnatify-crm/app
git clone <repo-url> .
cp /secure/location/.env .env
docker compose build
docker compose up -d postgres redis
docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < /opt/unnatify-crm/backups/latest.sql
rsync -avz /backup/location/uploads/ /opt/unnatify-crm/uploads/
docker compose run --rm backend npm run prisma:deploy
docker compose up -d
```

After recovery:

```bash
curl -s http://127.0.0.1:4000/health
curl -s http://127.0.0.1:4000/health/db
curl -s http://127.0.0.1:4000/health/redis
curl -s http://127.0.0.1:4000/health/workers
curl -I https://app.unnatify.com
```

Rotate secrets after recovery if the old VPS may have been compromised.

---
