# RepoQuery — self-hosted GitHub repository Q&A and code intelligence

**RepoQuery** is an open-source, self-hosted **repository intelligence** app: connect **public GitHub** repos, **index** code, docs, issues, pull requests, discussions, and commits into **PostgreSQL with pgvector**, then **chat** with an AI that answers from **retrieved evidence** (RAG-style workflow). Run it locally with **Docker** for the database, **Node.js** for the **React + Vite** frontend and **NestJS + Prisma** backend, and configure **OpenAI**, **OpenAI-compatible** APIs (e.g. OpenRouter), or **Ollama** plus an optional **GitHub personal access token** in **Settings** (stored in the database) for higher GitHub API rate limits.

If you are looking for a **self-hosted GitHub Q&A**, **repo search with embeddings**, **pgvector NestJS** example, or **Docker Compose Postgres** setup for a **TypeScript monorepo**, this README walks through **clone → install → `.env` → Docker & database (first time) → `npm run dev` → Settings** in order.

---

## Local development order (read this first)

Do **not** run `npm run dev` until **Docker is running** and the **database has been initialized** (first-time: `npm run setup:dev`). Typical order:

1. **Docker Desktop** (or Docker Engine) is installed and **running**.
2. From the repo root: `npm install` → copy `.env` from `.env.example`.
3. **First time on this machine:** **`npm run setup:dev`** — runs **`db:up`** (PostgreSQL + pgvector in Docker), initializes the DB (`vector` extension + Prisma), and builds `shared`. **Docker must be running before this command.**
4. Later sessions: if the DB container was stopped, run **`npm run db:up`** again (no need to repeat `setup:dev` unless you reset the DB).
5. **`npm run dev`** (repo root) — starts **both** the **NestJS backend** (watch) and the **Vite frontend** (dev server) in one command.

After the UI loads, open **Settings** and add your **AI** provider and optional **GitHub** token.

---

## What RepoQuery does

- **Projects**: Each project maps to one **public** GitHub repository (owner/name).
- **Ingestion & indexing**: Fetches repository tree, file contents, README/docs-style paths, **issues**, **PRs**, **discussions**, and **commit history**, then chunks and stores vectors for semantic search.
- **Chats**: Multiple conversations per project; messages and assistant replies are persisted.
- **Answers**: The assistant uses **tools** (code search, history, file view) so responses stay tied to **repository evidence** rather than guessing.
- **Sync**: Manual refresh per project and scheduled checks to keep the index fresh.

### v1 limitations

- **Self-hosted** only (no managed SaaS in this repo).
- **Public GitHub repositories** only (no private repos or org billing flows).
- **No end-user authentication** in the UI (suitable for a trusted local or internal network).

---

## What uses what (architecture)

| Layer | Technology | Role |
|--------|------------|------|
| **Frontend** | React 19, Vite, TypeScript, React Router, TanStack Query, Zustand | SPA UI; calls the API via `VITE_API_BASE_URL`. |
| **Backend** | NestJS, Prisma | REST API, orchestration, scheduling, GitHub + LLM calls. |
| **Database** | PostgreSQL **16** + **pgvector** (Docker image `pgvector/pgvector:pg16`) | App data + vector embeddings (`docker/postgres/init.sql` enables `vector`). |
| **Shared package** | `@repo-intel/shared` | Shared enums/DTOs/types across frontend and backend. |
| **GitHub API** | Octokit | Repo metadata, trees, files, issues, PRs, discussions; optional token from **Settings** only (unauthenticated if unset). |
| **AI** | OpenAI SDK–style HTTP to configured base URL | Chat + embeddings per **Settings**: OpenAI, OpenAI-compatible URL, or Ollama’s OpenAI-compatible endpoint. |

Data flow (simplified):

```text
Browser (React) ──HTTP──► NestJS API ──► Prisma ──► PostgreSQL + pgvector
                              │
                              ├──► GitHub REST (Octokit)
                              └──► LLM / embeddings (provider from Settings)
```

---

## Prerequisites

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (or Docker Engine + Compose) — **required** before `npm run dev` so PostgreSQL can run locally.
- **[Node.js](https://nodejs.org/)** **20+** (LTS recommended) and **npm**.
- A **GitHub account** (optional token in **Settings** for higher API limits).
- An **AI provider**: [OpenAI API key](https://platform.openai.com/), an **OpenAI-compatible** host (e.g. OpenRouter), or **[Ollama](https://ollama.com/)** running locally with chat + embedding models pulled.

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/SSujitX/RepoQuery.git
cd RepoQuery
```

---

## Step 2 — Install JavaScript dependencies

From the **repository root** (the folder that contains `package.json`, `frontend/`, `backend/`, and `shared/`):

```bash
npm install
```

This installs root tooling and all **npm workspaces** (`frontend`, `backend`, `shared`).

---

## Step 3 — Environment file (`.env`)

Copy the example env file at the repo root:

```bash
cp .env.example .env
```

Edit `.env` if needed:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | Must match Docker Compose (default): `postgresql://postgres:postgres@localhost:5432/repo_intel` |
| `PORT` | No | Backend port (default **4000**) |
| `APP_ORIGIN` | No | Frontend origin for CORS (default `http://localhost:5173`) |
| `VITE_API_BASE_URL` | No | API base URL the **Vite** app calls (default `http://localhost:4000`) |

**Secrets:** GitHub and AI credentials are **not** set in `.env`. Configure them in the **Settings** page in the app (stored in the database).

---

## Step 4 — Docker: PostgreSQL (before `npm run dev`)

The stack uses **Docker Compose** only for **Postgres + pgvector** (the app itself runs on Node, not in Docker for local dev).

**First-time setup** already starts the DB via **`npm run setup:dev`** (Step 5), which includes `db:up`. Use this step when you only need to **start or verify** the container.

1. Start **Docker Desktop** (or your Docker daemon).
2. From the repo root:

```bash
npm run db:up
```

This runs `docker compose up -d postgres` using `docker-compose.yml`:

- **Image:** `pgvector/pgvector:pg16`
- **Container name:** `repo-intel-postgres`
- **Port:** `5432` on the host
- **Database:** `repo_intel` (user/password `postgres` / `postgres` in the default compose file)

Verify the container is running:

```bash
docker ps --filter name=repo-intel-postgres
```

Optional: view database logs.

```bash
npm run db:logs
```

To stop the database:

```bash
npm run db:down
```

---

## Step 5 — First-time database install (schema + shared build)

Run **once** per machine (or after wiping the DB volume). **Docker must be running.**

```bash
npm run setup:dev
```

This runs: **`db:up`** → **`db:init`** (SQL `CREATE EXTENSION IF NOT EXISTS vector`, Prisma generate + `db push`) → **`npm run build --workspace shared`**.

If you already ran **`npm run db:up`** in Step 4, `setup:dev` simply runs `db:up` again (harmless) then continues with init.

**Manual equivalent** (if you prefer):

```bash
npm run db:up
docker exec repo-intel-postgres psql -U postgres -d repo_intel -c "CREATE EXTENSION IF NOT EXISTS vector;"
npm run prisma:generate --workspace backend
npm run prisma:push --workspace backend
npm run build --workspace shared
```

For **migration-based** workflows in other environments:

```bash
npm run prisma:migrate --workspace backend
```

---

## Step 6 — Run the app (`npm run dev` runs frontend + backend)

**Only after** Docker is up and Step 5 has succeeded, from the repo root:

```bash
npm run dev
```

This **builds the `shared` workspace once**, then runs **two processes** together:

- **Backend:** NestJS in watch mode (API + Prisma).
- **Frontend:** Vite dev server (React SPA).

| Service | URL |
|---------|-----|
| **Frontend** | [http://localhost:5173](http://localhost:5173) |
| **Backend** | [http://localhost:4000](http://localhost:4000) |
| **Health** | [http://localhost:4000/health](http://localhost:4000/health) |

Run workspaces separately if needed:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Step 7 — Settings: GitHub token and AI provider

Open `http://localhost:5173` → **Settings**.

### GitHub token (recommended)

Without a token, GitHub **unauthenticated rate limits** apply. Add a **personal access token** in **Settings** (classic or fine-grained with appropriate **read** access to public repo data you need).

Create a token: [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens).

### AI provider (required for chat)

Supported **provider types**:

| Provider type | API key | Base URL | Typical use |
|---------------|---------|----------|-------------|
| **OpenAI** | Required | Leave default / empty for official API | Production-quality models and embeddings |
| **OpenAI-compatible** | Usually required | e.g. `https://openrouter.ai/api/v1` | OpenRouter, LM Studio, vLLM, etc. |
| **Ollama** | Not used | e.g. `http://localhost:11434/v1` | Local models; ensure Ollama is running and models are pulled |

Set **chat model** and **embedding model** names to match your provider.

Check configuration status:

- **GET** `/settings/status` → `aiConfigured` and a human-readable `reason` if something is missing.

---

## How to use the product (after setup)

1. Open **Settings** and confirm **AI** (and optionally **GitHub**) are configured.
2. Create a **project** with a public repo `owner/name`.
3. Wait for **indexing / sync** to progress (use the project’s **Sync** control as needed).
4. Open or create a **chat** and ask questions; use **evidence** / sources in the UI to verify what the model relied on.

The system is designed to **avoid misleading claims**: when evidence is missing, replies should indicate uncertainty or lack of repository support.

---

## Production build (local)

```bash
npm run build
```

Backend start in production typically uses `DATABASE_URL` and `npm run start:prod --workspace backend` after a deploy step; adjust hosting, reverse proxy, and secrets for your environment.

---

## Scripts reference (root `package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Build `shared`, then run **backend + frontend** together in watch/dev mode |
| `npm run setup:dev` | `db:up` + DB init (vector + Prisma) + build `shared` — use **first time** (or after reset) |
| `npm run db:up` / `db:down` / `db:logs` | Docker Compose lifecycle for Postgres |
| `npm run build` | Build shared, backend, and frontend |
| `npm run lint` | Lint backend and frontend |

---

## Repository layout

```text
RepoQuery/
  frontend/          # React + Vite SPA
  backend/           # NestJS API + Prisma schema
  shared/            # Shared TypeScript package
  docker/
    postgres/
      init.sql       # CREATE EXTENSION vector;
  docker-compose.yml # PostgreSQL + pgvector service
  .env.example       # Template for root .env (no secrets)
  README.md
```

---

## Contributing

Use the GitHub issue tracker for bug reports and feature discussions; pull requests are welcome when they match project scope (self-hosted, public repos, no auth/billing in v1).
