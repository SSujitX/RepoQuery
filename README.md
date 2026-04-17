# Repo Intelligence App

Self-hosted, open-source, project-based GitHub repository intelligence app.

## What it does

- Create projects, each mapped to one public GitHub repository.
- Ingest and index repository files, docs, issues, pull requests, discussions, and commits.
- Create multiple chats per project and store chat history.
- Answer questions using only repository evidence.
- Run daily refresh checks and manual refresh per project.

## Stack

- Frontend: React + Vite + TypeScript + React Router + TanStack Query + Zustand
- Backend: NestJS + TypeScript + Prisma
- Database: PostgreSQL + pgvector (Docker Compose)
- Shared: shared TypeScript package for enums/types

## Project structure

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

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Start PostgreSQL:

```bash
npm run db:up
```

4. Run migrations and generate client:

```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend
```

5. Start app:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Configure AI provider from the Settings page in the UI (saved to database).

## Accuracy and anti-misleading policy

- The system answers from repository evidence only.
- It does not claim full-repository analysis unless that exact operation occurred.
- If evidence is missing:
  - `No direct evidence found in this repository.`
  - `Insufficient repository evidence to answer confidently.`

## v1 constraints

- Self-hosted only
- Public GitHub repositories only
- No auth, billing, or SaaS hosting
- No private repositories, team accounts, or enterprise features
