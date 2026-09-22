# Infrastructure (Phase 0a — A3)

Repo-side infrastructure-as-code plus the founder runbook. Implements `docs/specs/0a-plan.md`
A3 (Coolify environments · Cloudflare edge · observability) and the backup half of A5.

> **Builder boundary:** everything in this folder is config and instructions. Provisioning
> servers, installing Coolify, creating Cloudflare/DNS records, and setting secrets are
> **founder actions** — the builder never holds production credentials (D54).

## Environments (ARCH §20)

| Env | Where (now) | Where (target, D49) |
|---|---|---|
| local | `docker-compose.yml` at repo root | — |
| staging | **laptop server** via Coolify | Biznet GIO |
| production | **laptop server** via Coolify (temporary) | Biznet GIO + separate DB host |

> The laptop is a **temporary stand-in** for Biznet (D10/D49 remain the locked target).
> All compose here is written to lift-and-shift to Biznet unchanged.

## 0. Coolify prerequisite — needs a Linux host

Checked this machine on 21 Sep 2026: **no running Coolify was found** (Docker Desktop's
engine was stopped, no Linux WSL distro besides Docker's internal one, nothing on Coolify's
ports). Coolify is Linux-native and **not officially supported on Windows**. Pick one:

- **WSL2 Ubuntu on the laptop** — `wsl --install -d Ubuntu`, then run Coolify's install
  script inside it (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`). Docker
  must run in that distro.
- **A small Linux VM / server** (preferred; closest to Biznet). Move here as soon as practical.

Verify Coolify is up: its dashboard responds on `:8000`. Put it behind **Cloudflare Access** (below).

## 1. Cloudflare (edge — D53)

Laptop has no stable public IP, so expose services with a **Cloudflare Tunnel** (`cloudflared`):

1. In Cloudflare Zero Trust → Tunnels, create a tunnel; run `cloudflared` on the server.
2. Route hostnames to local ports:
   - `app.<domain>` → web · `console.<domain>` → console · `<domain>`/`www` → site
   - `coolify.<domain>` → `localhost:8000` (dashboard)
   - `errors.<domain>` → `localhost:8080` (GlitchTip) · `status.<domain>` → `localhost:3001` (Uptime Kuma)
3. **Cloudflare Access** in front of `coolify.<domain>` and `errors.<domain>` (staff only).
4. **Turnstile** on the signup form; proxy/WAF/CDN for the site and public pages.

> Deviation to note: with a laptop behind a Tunnel, `web`/`console` are necessarily proxied
> through Cloudflare. D53's "web/console DNS-only" applies once on Biznet with a public IP.

## 2. Stacks

Each stack has its own `.env` (copy from `.env.example`; **never commit** real values).

- **Database** — `infra/database/` — Postgres 18 + pgvector behind PgBouncer (transaction
  mode). `cp .env.example .env && docker compose up -d`. App connects on `:6432`.
  Generate the PgBouncer `userlist.txt` from the role SCRAM verifiers (see the example file).
- **Observability** — `infra/observability/` — GlitchTip (`:8080`) + Uptime Kuma (`:3001`).
  `cp .env.example .env`, set `SECRET_KEY`/passwords, `docker compose up -d`, run the
  one-shot `glitchtip-migrate` first.
- **Backups** — `infra/backups/` — pgBackRest PITR + the monthly restore drill.

In Coolify, add each as a Docker Compose resource (or app), set env vars in Coolify's UI,
and let Coolify manage TLS/routing (or route via the Tunnel).

## 3. Secrets checklist (founder sets; never in the repo)

**Coolify env (per environment):** `POSTGRES_SUPERUSER_PASSWORD`, the `kc_*` role passwords,
`DATABASE_URL` (through PgBouncer), `GLITCHTIP_*`, app secrets (`BETTER_AUTH_SECRET`, ≥32
chars), object-storage keys (after O15).

**GitHub Actions secrets (for CI deploy):** `COOLIFY_WEBHOOK_URL`, `COOLIFY_API_TOKEN`, and
`STAGING_DATABASE_URL` (the migrate step stays skipped until this exists).

## 4. CI deploy

`.github/workflows/ci.yml` `deploy` job (staging, on push to `main`) calls the Coolify
deploy webhook when `COOLIFY_WEBHOOK_URL` is set, and no-ops otherwise. Coolify pulls the
new commit and redeploys. Production stays gated (ARCH §18).

## 5. Moving to Biznet later (D49)

Stand up the Biznet servers, run the same stacks, point DNS/Tunnel (or a public IP with
`web`/`console` DNS-only per D53) at them, restore the database from pgBackRest, and retire
the laptop. No compose changes required.
