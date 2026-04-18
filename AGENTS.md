# RepoQuery — agent / LLM project map

This file is the **single orientation document** for coding agents and LLMs working in this repository. Read it before large edits so you know **which folder owns which concern** and how data flows end-to-end.

---

## What RepoQuery is

- **Self-hosted** web app: connect **public GitHub** repos, **ingest** code + issues + PRs + discussions + commits into **PostgreSQL + pgvector**, then **chat** with an LLM that uses **tools** (search codebase, search history, view file) and returns **evidence-grounded** answers.
- **v1 product constraints:** no end-user auth in the UI, no billing, public repos only, tokens for AI + optional GitHub live in **Settings** (DB), not in `.env` (except `DATABASE_URL`, ports, CORS origin, `VITE_API_BASE_URL` at build time).
- Long-form product notes may also exist in `GOAL.md` (do not treat as executable spec unless it matches code).

---

## Repository tree (physical)

```text
RepoQuery/
├── AGENTS.md                 ← this file (agent / LLM orientation)
├── README.md                 ← human setup (Docker, npm, Settings)
├── package.json              ← npm workspaces root; scripts: dev, build, db:up, setup:dev
├── docker-compose.yml        ← Postgres + pgvector only
├── docker/postgres/init.sql  ← enables `vector` extension
├── .env.example              ← non-secret env template
├── tsconfig.base.json        ← shared TS defaults (use lowercase "bundler")
│
├── shared/                   ← `@repo-intel/shared` workspace package
│   ├── package.json
│   ├── tsconfig.json
│   └── src/                  ← enums, DTO-ish types, constants used by FE + BE
│
├── backend/                  ← NestJS API
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma     ← DB models (Project, Chat, ChatMessage, chunks, etc.)
│   │   └── migrations/
│   └── src/
│       ├── main.ts           ← bootstrap: CORS from APP_ORIGIN, listen PORT
│       ├── app.module.ts     ← imports all feature modules
│       ├── config/app.config.ts
│       ├── db/prisma.*       ← PrismaService + shutdown hooks
│       ├── prompts/          ← system / agent prompt strings (search, verify, router, …)
│       └── modules/          ← one folder ≈ one bounded context (see below)
│
├── frontend/                 ← React + Vite SPA
│   ├── package.json
│   ├── vite.config.ts        ← `@repo-intel/shared` alias to ../shared/src
│   ├── index.html
│   └── src/
│       ├── main.tsx, App.tsx
│       ├── router/AppRouter.tsx
│       ├── api/client.ts     ← fetch wrapper → VITE_API_BASE_URL
│       ├── app/AppShell.tsx  ← layout, sidebar, project chrome
│       ├── pages/            ← route-level screens
│       ├── components/       ← reusable UI (chat, header, settings, …)
│       ├── features/         ← small domains (zustand store, delete cache, …)
│       ├── hooks/, lib/, types/
│       └── index.css         ← global + chat UI tokens
│
└── screenshot/               ← README screenshots (optional assets)
```

---

## `shared/` — what it does

| Area | Role |
|------|------|
| `shared/src/enums/*` | `ProjectStatus`, `SyncRunStatus`, `SourceType`, `QuestionType` — aligned with Prisma / API. |
| `shared/src/types/*` | Cross-cutting types consumed by frontend `types/app.ts` patterns and backend where imported. |
| `shared/src/constants` | Shared literals if any. |

**Rule:** If you add a new status or source type used in API + UI, prefer defining it here and importing from `@repo-intel/shared` in both workspaces.

---

## `backend/` — NestJS application map

### Entry & wiring

| File | Responsibility |
|------|----------------|
| `src/main.ts` | `ValidationPipe`, **CORS** `origin: APP_ORIGIN`, listen `PORT`. |
| `src/app.module.ts` | Registers **all** feature modules + `ConfigModule`, `ScheduleModule`, `PrismaModule`. |
| `src/config/app.config.ts` | Maps env: `NODE_ENV`, `PORT`, `APP_ORIGIN`, `DATABASE_URL`. |

### Database

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Single source of truth for tables: projects, chats, messages, sync runs, repository files, chunks, embeddings, settings, etc. |
| `src/db/prisma.module.ts` / `prisma.service.ts` | Global Prisma client; `enableShutdownHooks` in `main.ts`. |

### Feature modules (`src/modules/<name>/`)

Each folder typically contains `<name>.module.ts`, `<name>.service.ts`, sometimes `<name>.controller.ts`, and `dto/`.

| Module | Folder | Primary responsibility |
|--------|--------|---------------------------|
| **Health** | `health/` | `GET /health` liveness. |
| **Settings** | `settings/` | `GET/PUT /settings`, `GET /settings/status`; AI + GitHub tokens in DB; `validateAiConfiguration()`. |
| **Providers** | `providers/` | OpenAI-compatible client: `complete`, `completeWithTools` with optional **`AbortSignal`** (cancels HTTP to provider). |
| **Github** | `github/` | Octokit: metadata, tree, **blobs** (ingestion), issues, PRs, discussions, commits; token from Settings only. |
| **Projects** | `projects/` | CRUD projects, repo preview, **sync trigger**, status, sources listing, sync runs. |
| **Ingestion** | `ingestion/` | Full repo sync job: GitHub fetch → persist tree/files/history → kicks indexing. |
| **Indexing** | `indexing/` | Chunking / symbol indexing / embeddings for search (after ingestion). |
| **Retrieval** | `retrieval/` | DB + vector search used by agent tools (`searchCodebase`, `searchHistory`, `viewFile`). |
| **Agents** | `agents/` | `AgentOrchestratorService`: tool loop, prompts, calls `ProvidersService` + `RetrievalService`. |
| **Chats** | `chats/` | Chats CRUD, **`POST /chats/:id/messages`** (user message → orchestrator → assistant message), SSE thoughts stream, **stop/abort** handling + `ensureStoppedAssistantIfPendingUser`. |
| **Scheduler** | `scheduler/` | Periodic / scheduled tasks (e.g. refresh checks) using `@nestjs/schedule`. |

### HTTP surface (high level)

Routes are split across controllers; prefix is global (no `/api` unless you add it in reverse proxy).

- **`/health`** — health.
- **`/settings`**, **`/settings/status`** — AI/GitHub configuration.
- **`/projects`** — list/create/delete projects, preview repo, **POST …/sync**, status, sources, sync-runs.
- **`/chats/:chatId`**, **`/chats/:chatId/messages`** — chat + messages.
- **`POST /chats/:chatId/messages`** — long-running: creates user row, runs agent, creates assistant row (or stopped row on abort).
- **`GET /chats/:chatId/thoughts` (SSE)** — `ChatsController` maps `emitThought` payloads to `{ data: { text: string } }` per Nest `@Sse` conventions. The current SPA primarily relies on **`POST …/messages`** completion + message refetch rather than consuming this stream (search the repo before assuming a frontend `EventSource` exists).

### Agent & prompts

| Path | Role |
|------|------|
| `src/prompts/search-agent.prompt.ts` | Main “search agent” system prompt for tool use. |
| `src/prompts/verify-agent.prompt.ts` | Validates proposed `finishAnswer` output. |
| `src/prompts/*-agent.prompt.ts` | Other agent personas (router, docs, history, code, final-answer) — use depends on orchestration evolution. |
| `src/modules/agents/agent-orchestrator.service.ts` | **Core loop:** `completeWithTools` → tool calls (`searchCodebase`, `searchHistory`, `viewFile`, `finishAnswer`) → verify step → answer + `evidenceList`. Honors **`AbortSignal`** between rounds (not inside one long DB call unless added later). |

### Chat stop / abort (important for agents editing this flow)

- `ChatsController` wires **`AbortSignal`** to client disconnect + passes signal into `ChatsService.createMessage`.
- `ChatsService` persists **`ChatsService.ASSISTANT_STOPPED_CONTENT`** via **`ensureStoppedAssistantIfPendingUser`** (idempotent, Serializable transaction) on abort or `req.close`.
- Frontend must keep **`ASSISTANT_STOPPED_MESSAGE`** in `frontend/src/lib/chat-constants.ts` **in sync** with backend string.

---

## `frontend/` — React + Vite map

### Entry & routing

| File | Role |
|------|------|
| `src/main.tsx` | React root, providers. |
| `src/App.tsx` | Top-level shell wiring. |
| `src/router/AppRouter.tsx` | Routes: home, project dashboard, chat, settings, legacy redirects. |
| `src/app/AppShell.tsx` | Sidebar, main content outlet, project navigation, delete-project cache integration. |

### API layer

| File | Role |
|------|------|
| `src/api/client.ts` | All REST calls; parses JSON **error.message** on failures; **`createMessage(..., { signal })`** for stop. |
| Env | `import.meta.env.VITE_API_BASE_URL` — baked at **build** time for production. |

### Pages (`src/pages/`)

| Page | Role |
|------|------|
| `RootPage.tsx` | Project list (centered), create/delete project entry points. |
| `ProjectDashboardPage.tsx` | Project hub: chats list, sync, status polling. |
| `ChatPage.tsx` | Active chat: messages query, **send mutation + AbortController stop**, sync strip, `ChatWindow`. |
| `SettingsPage.tsx` | AI provider + GitHub token form. |

### Key components (`src/components/`)

| Component | Role |
|-----------|------|
| `ChatWindow.tsx` | Thread scroll, composer, **Send vs Stop** while `isPending`, passes errors / pending user bubble. |
| `MessageBubble.tsx` | User/assistant bubbles, markdown, copy/download, evidence chips. |
| `ThinkingCollapsible.tsx` | “Thinking” UI while awaiting assistant. |
| `ProjectHeader.tsx` | Repo title, sync button, status. |
| `Sidebar.tsx` | Nav + project list drawer. |
| `SettingsForm.tsx` / `ProviderSelector.tsx` / `AiConnectModal.tsx` | Settings UX. |

### State & helpers

| Path | Role |
|------|------|
| `features/projects/project-store.ts` | Zustand: `currentProjectId`, etc. |
| `features/projects/delete-project-cache.ts` | TanStack Query cache updates after project delete. |
| `lib/evidenceChips.ts`, `lib/markdownChat.ts`, `lib/assistantMessageFormat.ts` | Parsing / formatting assistant content + evidence. |
| `lib/chat-constants.ts` | Stopped-message literal (must match backend). |

---

## End-to-end flows (mental model)

### 1) User adds a project and syncs

1. UI → **`POST /projects`** with repo URL / branch.
2. Backend resolves GitHub metadata (`GithubService`), creates `Project`.
3. User triggers sync → **`POST /projects/:id/sync`** → `IngestionService` runs (Git tree, blobs, issues, PRs, discussions, commits) → `IndexingService` builds chunks/embeddings.
4. UI polls **`GET /projects/:id/status`** (and related queries) for progress.

### 2) User chats

1. UI → **`POST /chats/:chatId/messages`** with `{ content }` (optional **`AbortSignal`**).
2. `ChatsService` validates AI settings, inserts **user** `ChatMessage`, loads short history, calls **`AgentOrchestratorService.answerQuestion`** (with `emitThought` → SSE).
3. Orchestrator repeatedly calls **`ProvidersService.completeWithTools`**; tools hit **`RetrievalService`** (DB/pgvector).
4. On success: assistant `ChatMessage` with `evidenceJson` (+ `evidenceList` merge rules in service).
5. On **Stop**: fetch aborted → server aborts OpenAI HTTP + loop; **`ensureStoppedAssistantIfPendingUser`** appends assistant row with stopped text.

### 3) Configuration

- **AI** (provider type, base URL, models, API key) and **GitHub token** live in **Settings** (Prisma), not `.env`.
- **CORS:** backend trusts **`APP_ORIGIN`** only.

---

## Commands agents should know

| Command | Where | Purpose |
|---------|--------|---------|
| `npm install` | repo root | Install all workspaces. |
| `npm run setup:dev` | repo root | Docker Postgres up + Prisma + build `shared` (first-time / reset). |
| `npm run dev` | repo root | Build `shared`, run **backend + frontend** concurrently. |
| `npm run build` | repo root | Production build all packages. |
| `npm run prisma:migrate` / `prisma:push` | `backend/` | Schema changes (see `backend/package.json`). |

---

## Conventions for safe edits

1. **Do not commit secrets** — `.env` is gitignored; Settings tokens live in DB.
2. **Match existing patterns** — Nest module per feature; React Query for server state; Zustand only where already used.
3. **Keep `ASSISTANT_STOPPED_MESSAGE` and `ChatsService.ASSISTANT_STOPPED_CONTENT` identical** when changing stop copy.
4. **TypeScript:** `moduleResolution` values are **lowercase** `"bundler"` in `tsconfig.base.json`.
5. **GitHub file reads in ingestion** prefer **git blob API** (`GithubService.fetchBlobContent`) over deprecated contents API where applicable.

---

## “If I change X, open Y first”

| Goal | Start here |
|------|------------|
| New REST endpoint | Relevant `*.controller.ts` + `*.service.ts` in `backend/src/modules/…` |
| DB shape / relations | `backend/prisma/schema.prisma` then migration |
| Agent behavior / tools | `agent-orchestrator.service.ts`, `retrieval.service.ts`, `prompts/*` |
| LLM provider HTTP / models | `providers.service.ts`, `settings.service.ts` |
| Chat UX / stop / errors | `ChatPage.tsx`, `ChatWindow.tsx`, `api/client.ts`, `chats.service.ts` |
| Sync / indexing | `ingestion.service.ts`, `indexing.service.ts`, `projects.controller.ts` |
| UI layout / tokens | `index.css`, `AppShell.tsx`, specific `components/*` |
| Shared enums/types | `shared/src/…` then run `npm run build --workspace shared` |

---

## Optional: point your editor at this file

Some workflows support `@AGENTS.md` or automatic inclusion of `AGENTS.md` for repository context. This document is maintained for **structural** accuracy; when it drifts from code, prefer fixing **either** the doc **or** the code and keeping them aligned.
