-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "api_key_encrypted" TEXT,
    "base_url" TEXT,
    "model_name" TEXT NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "github_token_encrypted" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo_url" TEXT NOT NULL,
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "default_branch" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_sync_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "summary_json" JSONB,
    "error_text" TEXT,

    CONSTRAINT "project_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_files" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "language" TEXT,
    "size_bytes" INTEGER NOT NULL,
    "content_text" TEXT NOT NULL,
    "last_seen_commit_sha" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_symbols" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "symbol_name" TEXT NOT NULL,
    "symbol_type" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,

    CONSTRAINT "repository_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_chunks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_id" TEXT,
    "source_type" TEXT NOT NULL,
    "path" TEXT,
    "symbol_name" TEXT,
    "start_line" INTEGER,
    "end_line" INTEGER,
    "chunk_text" TEXT NOT NULL,
    "embedding" vector NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "github_issue_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" TEXT NOT NULL,
    "author" TEXT,
    "labels_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_pull_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "github_pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" TEXT NOT NULL,
    "author" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_discussions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "github_discussion_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_commits" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT,
    "committed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "evidence_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repository_files_project_id_path_key" ON "repository_files"("project_id", "path");

-- CreateIndex
CREATE UNIQUE INDEX "repository_issues_project_id_github_issue_number_key" ON "repository_issues"("project_id", "github_issue_number");

-- CreateIndex
CREATE UNIQUE INDEX "repository_pull_requests_project_id_github_pr_number_key" ON "repository_pull_requests"("project_id", "github_pr_number");

-- CreateIndex
CREATE UNIQUE INDEX "repository_discussions_project_id_github_discussion_number_key" ON "repository_discussions"("project_id", "github_discussion_number");

-- CreateIndex
CREATE UNIQUE INDEX "repository_commits_project_id_commit_sha_key" ON "repository_commits"("project_id", "commit_sha");

-- AddForeignKey
ALTER TABLE "project_sync_runs" ADD CONSTRAINT "project_sync_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_symbols" ADD CONSTRAINT "repository_symbols_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_symbols" ADD CONSTRAINT "repository_symbols_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "repository_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_chunks" ADD CONSTRAINT "repository_chunks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_chunks" ADD CONSTRAINT "repository_chunks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "repository_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_issues" ADD CONSTRAINT "repository_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_pull_requests" ADD CONSTRAINT "repository_pull_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_discussions" ADD CONSTRAINT "repository_discussions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_commits" ADD CONSTRAINT "repository_commits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
