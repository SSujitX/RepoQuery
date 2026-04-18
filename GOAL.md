# MASTER BUILD SPEC — SELF-HOSTED REPO INTELLIGENCE APP

## 1. Product goal

Build a **self-hosted, open-source, project-based GitHub repository intelligence app**.

A user will:

1. run the app locally
2. run PostgreSQL locally in Docker
3. configure an AI provider:

   * cloud API key
   * or local AI such as Ollama
   * or any OpenAI-compatible endpoint
4. create one or more **Projects**
5. paste a public GitHub repository URL into a project
6. let the app ingest and index the repository
7. open multiple chats inside that project
8. ask questions about the repository
9. receive **accurate, repo-grounded answers only**

The system must answer only from repository evidence such as:

* code files
* docs
* issues
* pull requests
* discussions
* commits

It must **not mislead** by claiming it “read the entire codebase” in the answer.
It should instead behave like this:

* user asks a question
* system routes the question to the right evidence sources
* system retrieves relevant repository evidence
* system answers based on that evidence only
* if evidence is insufficient, say so clearly

## 2. Non-negotiable product rules

### Accuracy rules

* Do **not** hallucinate
* Do **not** add generic advice unless explicitly asked
* Do **not** pretend the answer came from the whole repository if it came from selected evidence
* Do **not** say “I analyzed the full codebase” unless that is actually true for the current operation
* Final answer must be grounded only in repository evidence
* If the repo does not contain enough evidence, say:

  * `No direct evidence found in this repository.`
  * or
  * `Insufficient repository evidence to answer confidently.`

### Response rules

* Reply with the **smallest accurate answer possible**
* No extra motivational fluff
* No long generic explanation unless user asks
* Include evidence references when useful:

  * file path
  * symbol/function/class
  * issue number
  * PR number
  * discussion number/title
  * commit SHA

### System behavior rules

* The app is **project-based**
* One project = one GitHub repo
* One project can have many chats
* Repo is ingested/indexed once and reused across chats
* The app checks the repo daily for updates
* If repo changed, it refreshes indexed data
* User can also manually refresh a project

---

## 3. v1 scope

### Included in v1

* self-hosted only
* open-source only
* public GitHub repos only
* local PostgreSQL in Docker
* AI provider settings
* local Ollama support
* project sidebar
* multiple projects
* multiple chats per project
* repo ingestion
* indexing
* chat history
* daily repo refresh check
* manual refresh
* repo-only answers
* evidence-based answering

### Excluded from v1

* auth
* billing
* SaaS hosting
* team accounts
* private repo support
* GitLab/Bitbucket support
* collaborative workspaces
* permissions system
* enterprise features

---

## 4. Recommended architecture

Use a root project with separate frontend and backend folders plus shared code.

```text
repo-intelligence-app/
  frontend/
  backend/
  shared/
  docker/
  .env.example
  docker-compose.yml
  README.md
```

### Why this structure

* clear separation
* easy local development
* easy self-hosted setup
* shared types and schemas prevent duplication

---

## 5. Full folder structure

```text
repo-intelligence-app/
  frontend/
    src/
      app/
      components/
      pages/
      features/
        projects/
        chats/
        settings/
        sync-status/
      hooks/
      api/
      router/
      lib/
      styles/
      types/
      main.tsx

  backend/
    src/
      main.ts
      app.module.ts

      config/
      common/
      db/
      utils/
      prompts/
      jobs/
      adapters/

      modules/
        health/
        settings/
        providers/
        projects/
        github/
        ingestion/
        indexing/
        retrieval/
        agents/
        chats/
        scheduler/

  shared/
    src/
      types/
      enums/
      constants/
      schemas/
      dto/

  docker/
    postgres/
      init.sql

  docker-compose.yml
  .env.example
  README.md
```

---

## 6. Tech stack

### Frontend

* React
* Vite
* TypeScript
* React Router
* TanStack Query
* Zustand or simple context for local UI state
* Tailwind CSS
* basic markdown renderer for answer display

### Backend

* NestJS
* TypeScript
* PostgreSQL client or ORM
* pgvector
* scheduling/cron
* GitHub API integration
* embedding + chat provider abstraction

### Database

* PostgreSQL
* pgvector extension

### AI providers

Support these provider modes:

1. OpenAI
2. Anthropic later
3. OpenAI-compatible custom endpoint
4. Ollama local endpoint

### Parsing and retrieval

* Tree-sitter for code-aware parsing
* metadata search
* file path search
* symbol search
* text search
* vector search
* reranking later if needed

### Local runtime

* Docker Compose for Postgres
* frontend and backend can run via npm/pnpm locally
* optional Dockerization for backend/frontend later

---

## 7. What the app does

## Main product concept

This is **not** a general chatbot.

It is a **repository intelligence system** that:

* ingests a repo
* stores repository knowledge
* uses targeted retrieval
* routes questions to specialized agents
* returns only repository-grounded answers

### Important behavior

The system should **not** tell the user:

* “I read the whole codebase and here is the answer”

Instead it should do this internally:

* repo is indexed and searchable
* question is routed
* relevant evidence is fetched
* agents inspect the evidence
* final answer is produced from evidence only

That avoids misleading claims.

---

## 8. User flow

### Step 1 — run locally

User clones the repository and starts:

* PostgreSQL in Docker
* backend
* frontend

### Step 2 — configure provider

User opens Settings and provides:

* provider type
* API key if needed
* base URL if custom endpoint
* model name
* embedding model
* optional GitHub token

### Step 3 — create project

User clicks “New Project” and enters:

* project name
* repo URL
* optional branch
* optional description

### Step 4 — initial ingestion

Backend:

* validates repo URL
* fetches repo metadata
* fetches repository contents
* fetches docs/issues/PRs/discussions/commits
* stores normalized raw data
* parses code
* extracts symbols
* chunks content
* creates embeddings
* marks project ready

### Step 5 — create chats

Inside a project, user creates many chats:

* General
* Architecture
* Bugs
* Auth Flow
* Retry Logic
* History

### Step 6 — ask question

User asks:

* where auth logic lives
* how retry works
* what changed in recent PRs
* why issue x happened
* where HTTP request logic is
* which file handles webhook validation

### Step 7 — answer

System:

* routes the question
* gathers repo evidence
* runs agent flow
* answers only from repository evidence
* stores chat history

### Step 8 — refresh

Every day:

* scheduler checks latest repo state
* if changed, re-ingests and re-indexes changed content

User can also click Refresh manually.

---

## 9. Frontend requirements

### Main layout

Left sidebar:

* Projects list
* New Project button
* Settings link

Main content:

* project dashboard
* sync status
* chats list
* chat window
* evidence panel

### Required frontend pages

#### `/`

* redirect to first project or show empty state

#### `/projects/:projectId`

Project dashboard page:

* project name
* repo URL
* branch
* status
* last synced
* create chat button
* chats list
* refresh project button

#### `/projects/:projectId/chats/:chatId`

Chat page:

* chat messages
* composer input
* evidence panel
* history list in sidebar or subpanel

#### `/settings`

Provider settings:

* provider type
* API key
* base URL
* model name
* embedding model
* GitHub token

### Frontend components

* `Sidebar`
* `ProjectList`
* `NewProjectModal`
* `ProjectHeader`
* `SyncStatusBadge`
* `ChatList`
* `ChatWindow`
* `MessageBubble`
* `EvidencePanel`
* `SettingsForm`
* `ProviderSelector`
* `RepoInputForm`

### Frontend features

* create project
* view project sync state
* manually refresh project
* create chat
* send message
* show chat history
* show evidence sources
* show indexing status/errors

---

## 10. Backend modules

Use these modules.

### `health`

* health check endpoint

### `settings`

* save/load provider and GitHub settings

### `providers`

* provider abstraction
* OpenAI
* custom OpenAI-compatible endpoint
* Ollama adapter

### `projects`

* create/list/get/update project
* manage project metadata
* trigger sync

### `github`

* fetch repo metadata
* fetch tree
* fetch files
* fetch issues
* fetch PRs
* fetch discussions
* fetch commits

### `ingestion`

* normalize and store GitHub data
* handle initial sync and refresh sync

### `indexing`

* parse files
* extract symbols
* chunk content
* create embeddings
* upsert chunks

### `retrieval`

* search relevant evidence for a question

### `agents`

* route question
* invoke evidence analyzers
* assemble final answer

### `chats`

* create chats
* save messages
* answer messages

### `scheduler`

* daily update check
* enqueue/trigger project refresh

---

## 11. Core database schema

Use PostgreSQL + pgvector.

## Tables

### `settings`

Global app settings for self-hosted v1.

Fields:

* `id`
* `provider_type`
* `api_key_encrypted`
* `base_url`
* `model_name`
* `embedding_model`
* `github_token_encrypted`
* `created_at`
* `updated_at`

### `projects`

Fields:

* `id`
* `name`
* `repo_url`
* `repo_owner`
* `repo_name`
* `default_branch`
* `status`
* `last_synced_at`
* `last_checked_at`
* `created_at`
* `updated_at`

### `project_sync_runs`

Fields:

* `id`
* `project_id`
* `status`
* `started_at`
* `finished_at`
* `summary_json`
* `error_text`

### `repository_files`

Fields:

* `id`
* `project_id`
* `path`
* `sha`
* `language`
* `size_bytes`
* `content_text`
* `last_seen_commit_sha`
* `updated_at`

### `repository_symbols`

Fields:

* `id`
* `project_id`
* `file_id`
* `symbol_name`
* `symbol_type`
* `start_line`
* `end_line`

### `repository_chunks`

Fields:

* `id`
* `project_id`
* `file_id`
* `source_type`
* `path`
* `symbol_name`
* `start_line`
* `end_line`
* `chunk_text`
* `embedding`
* `updated_at`

### `repository_issues`

Fields:

* `id`
* `project_id`
* `github_issue_number`
* `title`
* `body`
* `state`
* `author`
* `labels_json`
* `updated_at`

### `repository_pull_requests`

Fields:

* `id`
* `project_id`
* `github_pr_number`
* `title`
* `body`
* `state`
* `author`
* `updated_at`

### `repository_discussions`

Fields:

* `id`
* `project_id`
* `github_discussion_number`
* `title`
* `body`
* `category`
* `updated_at`

### `repository_commits`

Fields:

* `id`
* `project_id`
* `commit_sha`
* `message`
* `author`
* `committed_at`

### `chats`

Fields:

* `id`
* `project_id`
* `title`
* `created_at`
* `updated_at`

### `chat_messages`

Fields:

* `id`
* `chat_id`
* `role`
* `content`
* `evidence_json`
* `created_at`

---

## 12. Project statuses

Use these statuses:

* `draft`
* `syncing`
* `ready`
* `refreshing`
* `error`

### Sync run statuses

* `running`
* `success`
* `failed`

---

## 13. Evidence sources

All answerable content should come from one or more of:

* repository code files
* repository documentation
* issues
* pull requests
* discussions
* commits

Source types:

* `code`
* `doc`
* `issue`
* `pr`
* `discussion`
* `commit`

---

## 14. Retrieval design

Use **hybrid retrieval**, not embeddings only.

### Retrieval methods

* exact file path search
* symbol search
* metadata filters
* text search
* vector similarity search

### Retrieval flow

1. classify question
2. determine source types needed
3. run retrieval over relevant indexes
4. select top evidence
5. pass evidence to specialized agents
6. final answer agent writes answer

---

## 15. Agent architecture

Do **not** use one giant agent.

Use a small structured agent system.

### A. Router Agent

Purpose:

* classify the question
* decide which evidence domains matter
* decide whether the question is code/docs/history/mixed

It does **not** answer the question.

### B. Code Agent

Purpose:

* inspect code evidence
* look at functions/classes/routes/config/tests
* explain implementation details only from code evidence

### C. History Agent

Purpose:

* inspect issues, PRs, commits, discussions
* explain bug history, design rationale, and prior decisions

### D. Docs Agent

Purpose:

* inspect README/docs/config/setup info
* explain setup, usage, architecture notes

### E. Final Answer Agent

Purpose:

* take evidence from prior agents
* produce smallest accurate answer possible
* never add unsupported assumptions

---

## 16. Exact prompts

These prompts should be stored in backend and used as system prompts.

## `router-agent.prompt.ts`

```txt
You are the Router Agent for a repository intelligence system.

Your job:
- classify the user's question
- decide which repository evidence sources are needed
- do not answer the question
- do not speculate
- output only a structured routing decision

Allowed source types:
- code
- docs
- issues
- prs
- discussions
- commits
- mixed

Rules:
- choose only the minimum necessary sources
- if the question is about implementation, prefer code
- if the question is about why something changed, prefer prs/issues/commits/discussions
- if the question is about setup or usage, prefer docs and config
- if uncertain, use mixed

Output format:
{
  "questionType": "code | docs | history | architecture | bug | mixed",
  "sources": ["code", "issues"],
  "reason": "short reason"
}
```

## `code-agent.prompt.ts`

```txt
You are the Code Agent for a repository intelligence system.

You analyze only code-related repository evidence.

Your job:
- inspect code files, symbols, functions, classes, handlers, configs, and tests when provided
- identify the exact implementation relevant to the user's question
- return concise findings only from the provided code evidence
- do not speculate beyond the evidence
- do not use outside knowledge
- do not claim to have read the whole repository
- do not answer from assumptions

Rules:
- cite file paths and symbols when possible
- prefer direct implementation evidence
- if the evidence is insufficient, say so clearly

Output format:
{
  "findings": [
    {
      "summary": "short exact finding",
      "evidence": [
        {
          "type": "code",
          "path": "src/example/file.ts",
          "symbol": "doThing",
          "lines": "10-40"
        }
      ]
    }
  ],
  "confidence": "high | medium | low",
  "insufficientEvidence": false
}
```

## `history-agent.prompt.ts`

```txt
You are the History Agent for a repository intelligence system.

You analyze only issues, pull requests, discussions, and commits.

Your job:
- find repository history relevant to the user's question
- identify prior decisions, bug history, rationale, or change context
- return concise findings only from the provided repository history evidence
- do not speculate
- do not use outside knowledge
- do not claim full repository analysis unless explicitly supported

Rules:
- cite issue numbers, PR numbers, discussion numbers/titles, and commit SHAs when possible
- if evidence is insufficient, say so clearly

Output format:
{
  "findings": [
    {
      "summary": "short exact finding",
      "evidence": [
        {
          "type": "issue | pr | discussion | commit",
          "ref": "#123 or SHA",
          "title": "title if available"
        }
      ]
    }
  ],
  "confidence": "high | medium | low",
  "insufficientEvidence": false
}
```

## `docs-agent.prompt.ts`

```txt
You are the Docs Agent for a repository intelligence system.

You analyze only repository documentation and configuration evidence.

Your job:
- inspect README files, docs, setup guides, config files, and architecture notes
- identify exact documented answers relevant to the user's question
- return concise findings only from the provided evidence
- do not speculate
- do not use outside knowledge
- do not claim complete repository analysis unless explicitly true

Rules:
- cite exact docs/config references when possible
- if evidence is insufficient, say so clearly

Output format:
{
  "findings": [
    {
      "summary": "short exact finding",
      "evidence": [
        {
          "type": "doc",
          "path": "README.md",
          "lines": "20-60"
        }
      ]
    }
  ],
  "confidence": "high | medium | low",
  "insufficientEvidence": false
}
```

## `final-answer-agent.prompt.ts`

```txt
You are the Final Answer Agent for a repository intelligence system.

You must answer the user's question using only the provided repository evidence and agent findings.

Rules:
- do not use outside knowledge
- do not speculate
- do not claim to have read the entire repository unless that is explicitly true in the evidence
- do not add generic filler
- produce the smallest accurate answer possible
- if evidence is insufficient, say:
  "No direct evidence found in this repository."
  or
  "Insufficient repository evidence to answer confidently."

Preferred answer structure:
1. direct answer
2. short evidence list if useful

Example style:
Answer:
The retry logic is implemented in src/http/client.ts inside createRetryHandler() and used by src/api/request.ts.

Evidence:
- src/http/client.ts: createRetryHandler
- src/api/request.ts

Keep the answer short and exact.
```

---

## 17. Internal orchestration flow

When a user asks a question:

1. load project context
2. load chat history if relevant
3. run Router Agent
4. determine source types
5. run retrieval for those source types
6. run:

   * Code Agent if code needed
   * History Agent if issues/PRs/discussions/commits needed
   * Docs Agent if docs needed
7. combine findings
8. run Final Answer Agent
9. save final answer and evidence in chat history

---

## 18. Important anti-misleading rule

This must be enforced everywhere:

### Never say:

* “I read the entire codebase and found…”
* “After fully analyzing all code…”
* “The whole repository shows…”

unless the system truly performed that exact operation for that specific answer.

### Instead say:

* “Based on the repository evidence…”
* “From the retrieved code and discussion evidence…”
* “The relevant implementation appears in…”
* “I found direct evidence in…”

This is critical.

---

## 19. Chat answer format

Use this answer style:

### If evidence exists

```txt
Answer:
<small direct answer>

Evidence:
- <file path / issue / pr / discussion / commit>
- <file path / issue / pr / discussion / commit>
```

### If evidence is weak

```txt
Answer:
Insufficient repository evidence to answer confidently.
```

### If nothing found

```txt
Answer:
No direct evidence found in this repository.
```

---

## 20. API contract

## Settings

* `GET /settings`
* `PUT /settings`

## Projects

* `GET /projects`
* `POST /projects`
* `GET /projects/:id`
* `POST /projects/:id/sync`
* `GET /projects/:id/status`
* `GET /projects/:id/chats`

## Chats

* `POST /projects/:id/chats`
* `GET /chats/:chatId/messages`
* `POST /chats/:chatId/messages`

## Sources / debug

* `GET /projects/:id/sync-runs`
* `GET /projects/:id/sources`

---

## 21. Environment variables

## `.env.example`

```env
# app
NODE_ENV=development

# backend
PORT=4000
APP_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/repo_intel

# llm provider
LLM_PROVIDER=openai
LLM_API_KEY=
LLM_BASE_URL=
LLM_MODEL=
EMBEDDING_MODEL=

# AI and GitHub: configure in Settings UI (stored in DB), not in .env

# frontend
VITE_API_BASE_URL=http://localhost:4000
```

---

## 22. Docker Compose

Use Docker only for PostgreSQL in v1 unless you want full containerized local startup.

## `docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: repo-intel-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: repo_intel
    ports:
      - "5432:5432"
    volumes:
      - repo_intel_pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  repo_intel_pgdata:
```

---

## 23. SQL bootstrap

## `docker/postgres/init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then create tables via migrations.

---

## 24. Suggested shared enums

Use these enums in `shared/src/enums`.

### `ProjectStatus`

* `DRAFT`
* `SYNCING`
* `READY`
* `REFRESHING`
* `ERROR`

### `SyncRunStatus`

* `RUNNING`
* `SUCCESS`
* `FAILED`

### `SourceType`

* `CODE`
* `DOC`
* `ISSUE`
* `PR`
* `DISCUSSION`
* `COMMIT`

### `QuestionType`

* `CODE`
* `DOCS`
* `HISTORY`
* `ARCHITECTURE`
* `BUG`
* `MIXED`

---

## 25. Suggested backend services

### `ProjectService`

* create project
* list projects
* get project
* update project status

### `GithubService`

* fetch repo metadata
* fetch tree
* fetch contents
* fetch issues
* fetch pull requests
* fetch discussions
* fetch commits

### `IngestionService`

* run initial sync
* run refresh sync
* store raw/normalized entities

### `IndexingService`

* parse files
* extract symbols
* chunk files/docs/history items
* embed chunks
* upsert chunks

### `RetrievalService`

* retrieve evidence by question and source types

### `AgentOrchestratorService`

* router
* call specialized agents
* combine findings
* run final answer

### `ChatService`

* create chat
* persist messages
* answer question

### `SchedulerService`

* daily project refresh check

---

## 26. Suggested frontend state model

### Global UI state

* current project
* current chat
* provider settings
* sync progress

### Project state

* project list
* selected project
* project status
* last synced
* chats list

### Chat state

* messages
* sending state
* evidence panel content

---

## 27. Build order

Follow this order exactly.

### Phase 1 — foundation

1. root structure
2. frontend Vite setup
3. backend Nest setup
4. shared package setup
5. Docker Compose with Postgres
6. env config loading

### Phase 2 — settings and projects

7. settings backend module
8. settings frontend page
9. projects backend module
10. projects frontend sidebar and create flow

### Phase 3 — ingestion

11. GitHub fetch service
12. initial project sync endpoint
13. persistence for repo metadata/files/issues/PRs/discussions/commits

### Phase 4 — indexing

14. parser integration
15. symbol extraction
16. chunking
17. embeddings
18. repository_chunks storage

### Phase 5 — chat

19. chat tables and APIs
20. chat UI
21. retrieval service
22. router agent
23. code/history/docs agents
24. final answer agent
25. message persistence

### Phase 6 — refresh and polish

26. daily scheduler
27. manual refresh button
28. sync history UI
29. evidence panel UI
30. error handling and empty states

---


## 28. Final one-paragraph summary

We are building a self-hosted open-source repository intelligence app with a root folder containing separate frontend and backend apps plus shared code. Users run PostgreSQL locally in Docker, configure a cloud AI provider or a local provider like Ollama, create projects from public GitHub repo URLs, and then chat inside each project. The backend ingests repository files, docs, issues, PRs, discussions, and commits; indexes them; routes each question to the right evidence sources using specialized agents; and returns only exact repository-grounded answers. The app must never mislead by claiming full-codebase analysis when it only used retrieved evidence. It must answer accurately, minimally, and only from code or discussions or issues or other repository sources relevant to the user’s question.

If you want, I can turn this into the next copy-ready block: **exact SQL tables, exact Nest file tree, and exact first implementation tasks file by file**.
