# TaskFlow Docker deployment

The production path is:

`Browser -> Caddy -> web (Nginx) -> api (FastAPI) -> Supabase agent function`

The browser receives only the Supabase publishable/anon key used for sign-in and
RLS. Provider keys and the Supabase service-role key must remain server-side.

## 1. Configure the server

Copy `backend/.env.example` to `backend/.env` and fill in the Supabase project
URL and publishable/anon key. Keep `CHAT_PROVIDER=supabase` to retain TaskFlow's
existing agent tools and authenticated RLS behavior.

Copy the root `.env.example` to `.env`, then set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Keep
`VITE_API_BASE_URL=/api`.

Never put an OpenAI/Groq key or a Supabase service-role key in a `VITE_`
variable. Vite embeds those values into public JavaScript.

## 2. Build and start

```bash
docker compose build --pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:3000/health
```

Both published ports listen on loopback only. They are not directly exposed to
the internet.

## 3. Configure Caddy

Copy the site block in `deploy/Caddyfile.example` into `/etc/caddy/Caddyfile`,
validate it, and reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy terminates HTTPS and forwards all traffic to the web container. Nginx
serves the SPA and forwards `/api/*` internally to FastAPI.

## 4. Updating

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f
```
