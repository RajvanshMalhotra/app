# Running Fundamentals on the HPC

The app is three containers:

| Container | Image | Port |
|---|---|---|
| Web app | `ghcr.io/rajvanshmalhotra/app-web` | 3000 |
| Math checker | `ghcr.io/rajvanshmalhotra/app-math` | 8001 |
| Database | `pgvector/pgvector:pg16` | 5432 |

The web app applies database migrations and adds the starter cards every time it starts. Both steps are safe to repeat.

First check what your cluster supports:

```bash
which docker podman apptainer singularity
uname -m        # x86_64 → uses the linux/amd64 images
```

## Before you start: settings

```bash
git clone https://github.com/RajvanshMalhotra/app.git fundamentals && cd fundamentals
cp .env.production.example .env.production
# Fill in AUTH_URL (the address you'll open in a browser), plus AUTH_SECRET and POSTGRES_PASSWORD:
openssl rand -hex 32    # run twice, one value each
```

Production has no dev login, so set Google (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`) or email (`EMAIL_SERVER`/`EMAIL_FROM`) sign-in. For Google, add `<AUTH_URL>/api/auth/callback/google` as an authorized redirect URI.

If the images are private on GitHub, log in once with a token that has the `read:packages` scope:

```bash
echo <token> | docker login ghcr.io -u RajvanshMalhotra --password-stdin
```

## Option A: Docker or Podman

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml logs -f web     # wait for "[startup] database ready"
```

With Podman, use `podman compose` (or `podman-compose`) in place of `docker compose`.

To update to a new release: `pull`, then `up -d` again.

## Option B: Apptainer (Singularity)

Apptainer runs Docker images without root. Containers share the host's network, so the services reach each other on `localhost`.

```bash
mkdir -p ~/fundamentals/{pgdata,pgrun} && cd ~/fundamentals
set -a; source /path/to/fundamentals/.env.production; set +a

# Convert the images once (re-run to update). Add --docker-login for private images.
apptainer pull web.sif  docker://ghcr.io/rajvanshmalhotra/app-web:latest
apptainer pull math.sif docker://ghcr.io/rajvanshmalhotra/app-math:latest
apptainer pull db.sif   docker://pgvector/pgvector:pg16

# 1. Database (data persists in ./pgdata)
apptainer instance start \
  --bind pgdata:/var/lib/postgresql/data --bind pgrun:/var/run/postgresql \
  --env POSTGRES_USER=app,POSTGRES_PASSWORD=$POSTGRES_PASSWORD,POSTGRES_DB=app \
  db.sif fundamentals-db
apptainer exec instance://fundamentals-db docker-entrypoint.sh postgres &

# 2. Math checker
apptainer instance start math.sif fundamentals-math
apptainer exec instance://fundamentals-math sh -c 'cd /app && uvicorn app:app --host 0.0.0.0 --port 8001' &

# 3. Web app
apptainer instance start --writable-tmpfs \
  --env DATABASE_URL=postgres://app:$POSTGRES_PASSWORD@localhost:5432/app,MATH_URL=http://localhost:8001 \
  --env AUTH_SECRET=$AUTH_SECRET,AUTH_URL=$AUTH_URL,AUTH_TRUST_HOST=true \
  --env AUTH_GOOGLE_ID=$AUTH_GOOGLE_ID,AUTH_GOOGLE_SECRET=$AUTH_GOOGLE_SECRET \
  --env NODE_ENV=production,PORT=3000,HOSTNAME=0.0.0.0,MIGRATE_ON_START=1 \
  web.sif fundamentals-web
apptainer exec instance://fundamentals-web sh -c 'cd /app && node server.js' &
```

To stop everything: `apptainer instance stop --all`.

Login nodes usually don't allow long-running services. Run this on a node you're allowed to keep a service on, or ask your admins which node to use.

## Reaching the app

If port 3000 isn't open to your network, tunnel it from your laptop:

```bash
ssh -N -L 3000:localhost:3000 you@hpc-host
# then open http://localhost:3000, with AUTH_URL=http://localhost:3000
```

## Checks

```bash
curl -s localhost:8001/health                                      # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/signin    # 200
```
