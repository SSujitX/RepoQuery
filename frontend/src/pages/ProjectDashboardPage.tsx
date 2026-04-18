import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { AiConnectModal } from "../components/AiConnectModal";
import { ProjectHeader } from "../components/ProjectHeader";
import { useProjectStore } from "../features/projects/project-store";
import type { ProjectStatus } from "@repo-intel/shared";

export function ProjectDashboardPage() {
  const { projectId: routeProjectId } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);
  const [activeTab, setActiveTab] = useState<"chats" | "sources">("chats");
  const [messageDraft, setMessageDraft] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [showAiConnectModal, setShowAiConnectModal] = useState(false);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: apiClient.getProjects,
  });

  const selectedProjectId = routeProjectId ?? "";

  useEffect(() => {
    if (routeProjectId && routeProjectId !== currentProjectId) {
      setCurrentProjectId(routeProjectId);
    }
  }, [routeProjectId, currentProjectId, setCurrentProjectId]);

  const projectQuery = useQuery({
    queryKey: ["project", selectedProjectId],
    queryFn: () => apiClient.getProject(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const projectStatusQuery = useQuery({
    queryKey: ["project-status", selectedProjectId],
    queryFn: () => apiClient.getProjectStatus(selectedProjectId),
    enabled: Boolean(selectedProjectId),
    refetchInterval: (query) => {
      const st = query.state.data?.status;
      if (st === "syncing" || st === "refreshing") {
        return 1200;
      }
      return false;
    },
  });

  const prevProjectStatus = useRef<ProjectStatus | undefined>(undefined);
  useEffect(() => {
    const st = projectStatusQuery.data?.status;
    const prev = prevProjectStatus.current;
    prevProjectStatus.current = st;
    if (!selectedProjectId || !st) {
      return;
    }
    if (
      (prev === "syncing" || prev === "refreshing") &&
      (st === "ready" || st === "error")
    ) {
      void queryClient.invalidateQueries({ queryKey: ["project", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-sources", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-sync-runs", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  }, [projectStatusQuery.data?.status, selectedProjectId, queryClient]);

  useEffect(() => {
    if (!selectedProjectId || !projectQuery.data) {
      return;
    }
    const listProject = projectsQuery.data?.find((p) => p.id === selectedProjectId);
    const detailStatus = projectQuery.data.status;
    const listStatus = listProject?.status;
    if (
      listStatus &&
      detailStatus &&
      listStatus !== detailStatus &&
      (detailStatus === "ready" || detailStatus === "error")
    ) {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  }, [selectedProjectId, projectQuery.data, projectsQuery.data, queryClient]);

  const chatsQuery = useQuery({
    queryKey: ["project-chats", selectedProjectId],
    queryFn: () => apiClient.getProjectChats(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: apiClient.getSettings,
  });
  const syncRunsQuery = useQuery({
    queryKey: ["project-sync-runs", selectedProjectId],
    queryFn: () => apiClient.getSyncRuns(selectedProjectId) as Promise<
      Array<{ id: string; status: string; startedAt: string; finishedAt: string | null }>
    >,
    enabled: Boolean(selectedProjectId),
  });
  const sourcesQuery = useQuery({
    queryKey: ["project-sources", selectedProjectId],
    queryFn: () =>
      apiClient.getSources(selectedProjectId) as Promise<{
        files: Array<{
          path: string;
          sha: string;
          language?: string | null;
          sizeBytes: number;
          updatedAt: string;
        }>;
        docs: Array<{ path?: string | null; updatedAt: string; chunkText: string }>;
        issues: Array<{
          githubIssueNumber: number;
          title: string;
          body?: string | null;
          state: string;
          author?: string | null;
          labelsJson?: unknown;
          updatedAt: string;
        }>;
        prs: Array<{
          githubPrNumber: number;
          title: string;
          body?: string | null;
          state: string;
          author?: string | null;
          updatedAt: string;
        }>;
        discussions: Array<{
          githubDiscussionNumber: number;
          title: string;
          body?: string | null;
          category?: string | null;
          updatedAt: string;
        }>;
        commits: Array<{ commitSha: string; message: string; author?: string | null; committedAt: string }>;
      }>,
    enabled: Boolean(selectedProjectId),
  });

  const codeFileTree = useMemo(() => {
    const files = sourcesQuery.data?.files ?? [];
    const root = emptyDirNode<SourceRepoFile>();
    for (const f of files) {
      insertByPath(root, f.path, f);
    }
    return root;
  }, [sourcesQuery.data?.files]);

  const docsPathTree = useMemo(() => {
    const docs = sourcesQuery.data?.docs ?? [];
    const root = emptyDirNode<SourceDocRow>();
    for (const doc of docs) {
      insertByPath(root, doc.path ?? "Other", doc);
    }
    return root;
  }, [sourcesQuery.data?.docs]);

  const syncMutation = useMutation({
    mutationFn: () => apiClient.syncProject(selectedProjectId),
    onMutate: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-status", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["project", selectedProjectId] });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-status", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-sync-runs", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-sources", selectedProjectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  useEffect(() => {
    if (!selectedProjectId || !syncMutation.isPending) {
      return;
    }
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["project-status", selectedProjectId] });
    }, 1000);
    return () => window.clearInterval(id);
  }, [syncMutation.isPending, selectedProjectId, queryClient]);

  const createChatMutation = useMutation({
    mutationFn: (payload: { title: string }) => apiClient.createChat(selectedProjectId, payload.title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-chats", selectedProjectId] });
    },
  });

  const deleteAllChatsMutation = useMutation({
    mutationFn: () => apiClient.deleteAllChats(selectedProjectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-chats", selectedProjectId] });
      queryClient.removeQueries({ queryKey: ["messages"] });
      if (location.pathname.includes(`/projects/${selectedProjectId}/chat/`)) {
        void navigate(`/projects/${selectedProjectId}`, { replace: true });
      }
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: ({ chatId }: { chatId: string }) => apiClient.deleteChat(selectedProjectId, chatId),
    onSuccess: (_, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: ["project-chats", selectedProjectId] });
      queryClient.removeQueries({ queryKey: ["messages", chatId] });
      if (location.pathname.includes(`/chat/${chatId}`)) {
        void navigate(`/projects/${selectedProjectId}`, { replace: true });
      }
    },
  });

  const requestDeleteAllChats = useCallback(() => {
    if (
      !window.confirm(
        "Delete every chat in this project? All messages are removed. This cannot be undone.",
      )
    ) {
      return;
    }
    void deleteAllChatsMutation.mutateAsync().catch(() => undefined);
  }, [deleteAllChatsMutation]);

  const requestDeleteChat = useCallback(
    (chatId: string, title: string) => {
      if (!window.confirm(`Delete chat “${title}” and all of its messages? This cannot be undone.`)) {
        return;
      }
      void deleteChatMutation.mutateAsync({ chatId }).catch(() => undefined);
    },
    [deleteChatMutation],
  );

  useEffect(() => {
    const el = composerTextareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "0";
    el.style.height = `${Math.min(280, Math.max(44, el.scrollHeight))}px`;
  }, [messageDraft]);

  const submitComposerChat = useCallback(() => {
    const input = messageDraft.trim();
    if (!input || createChatMutation.isPending) {
      return;
    }
    if (!isAiConfigured(settingsQuery.data)) {
      setShowAiConnectModal(true);
      return;
    }
    setComposerError(null);
    const autoTitle = generateChatTitle(input, chatsQuery.data?.length ?? 0);
    void createChatMutation
      .mutateAsync({ title: autoTitle })
      .then((createdChat) => {
        setComposerError(null);
        setMessageDraft("");
        navigate(`/projects/${selectedProjectId}/chat/${createdChat.id}`, {
          state: { initialMessage: input },
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          message.includes("ai provider is not configured") ||
          message.includes("ai api key is missing")
        ) {
          setComposerError("Connect AI in Settings before starting chat.");
          setShowAiConnectModal(true);
          return;
        }
        setComposerError(error instanceof Error ? error.message : "Unable to create chat.");
      });
  }, [
    chatsQuery.data?.length,
    createChatMutation,
    messageDraft,
    navigate,
    selectedProjectId,
    settingsQuery.data,
  ]);

  if (projectQuery.isLoading) {
    return <p>Loading project...</p>;
  }

  if (!projectQuery.data) {
    return (
      <section className="workspace">
        <p className="muted">
          {routeProjectId && projectQuery.isError
            ? "Project not found."
            : "Select a project from the sidebar, or open the home overview from the RepoQuery link."}
        </p>
      </section>
    );
  }

  const effectiveStatus = projectStatusQuery.data?.status ?? projectQuery.data.status;
  const projectForHeader = { ...projectQuery.data, status: effectiveStatus };
  const liveSync =
    effectiveStatus === "syncing" ||
    effectiveStatus === "refreshing" ||
    syncMutation.isPending;
  const syncRun = projectStatusQuery.data?.syncRun;
  const syncPercent = typeof syncRun?.percent === "number" ? syncRun.percent : 0;
  const syncMessage =
    syncRun?.message ??
    (projectStatusQuery.isFetching ? "Checking sync status…" : "Starting repository sync…");

  const projectName = projectQuery.data.name;

  return (
    <section className="workspace workspace-project-hub">
      <ProjectHeader
        variant="hub"
        project={projectForHeader}
        syncPending={syncMutation.isPending}
        onRefresh={() => syncMutation.mutateAsync()}
      />

      {liveSync ? (
        <section className="sync-progress-card proj-hub-sync-progress" aria-live="polite">
          <div className="sync-progress-head">
            <span className="muted">Repository sync</span>
            <span className="sync-progress-pct">{syncPercent}%</span>
          </div>
          <div className="sync-progress-bar" role="progressbar" aria-valuenow={syncPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="sync-progress-bar-fill" style={{ width: `${Math.min(100, syncPercent)}%` }} />
          </div>
          <p className="sync-progress-message">{syncMessage}</p>
          {syncRun?.phase ? (
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.78rem" }}>
              Step: {syncRun.phase}
            </p>
          ) : null}
          {syncRun?.logs?.length ? (
            <pre className="sync-progress-logs">{syncRun.logs.join("\n")}</pre>
          ) : null}
        </section>
      ) : null}

      <div className="proj-hub-wrap">
        <section className="proj-composer">
          <form
            className="proj-composer-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitComposerChat();
            }}
          >
            <div className="proj-composer-stack">
              <textarea
                ref={composerTextareaRef}
                className="proj-composer-input"
                rows={1}
                placeholder={`New chat in ${projectName}`}
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitComposerChat();
                  }
                }}
              />
              <div className="proj-composer-foot">
                <span className="proj-composer-hint muted">Shift+Enter newline · Enter send</span>
                <button
                  type="submit"
                  className="icon-btn primary-btn proj-composer-send"
                  disabled={!messageDraft.trim() || createChatMutation.isPending}
                  aria-label="Start chat"
                  title="Send (Enter)"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M5 12a1 1 0 0 1 1-1h8.59l-2.3-2.29a1 1 0 1 1 1.42-1.42l4 4a1 1 0 0 1 0 1.42l-4 4a1 1 0 0 1-1.42-1.42L14.59 13H6a1 1 0 0 1-1-1Z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </form>
          {composerError ? <p className="error-text proj-composer-error">{composerError}</p> : null}
        </section>

        <div className="proj-pill-tabs" role="tablist" aria-label="Project sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "chats"}
            className={`proj-pill-tab ${activeTab === "chats" ? "proj-pill-tab-active" : ""}`}
            onClick={() => setActiveTab("chats")}
          >
            Chats
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sources"}
            className={`proj-pill-tab ${activeTab === "sources" ? "proj-pill-tab-active" : ""}`}
            onClick={() => setActiveTab("sources")}
          >
            Sources
          </button>
        </div>

        {activeTab === "chats" ? (
          <>
            {(chatsQuery.data?.length ?? 0) > 0 ? (
              <div className="proj-chat-bulk-bar">
                <p className="proj-chat-bulk-hint muted">
                  Delete all chats removes every conversation and all messages in this project.
                </p>
                <button
                  type="button"
                  className="ghost-btn ghost-btn-sm proj-chat-action-btn proj-chat-action-btn-danger proj-chat-bulk-delete-all"
                  disabled={deleteAllChatsMutation.isPending || deleteChatMutation.isPending}
                  onClick={() => requestDeleteAllChats()}
                  title="Delete every chat in this project"
                >
                  Delete all chats
                </button>
              </div>
            ) : null}
            <div className="proj-chat-list">
              {(chatsQuery.data ?? []).map((chat) => {
                const deleteBusy =
                  deleteChatMutation.isPending &&
                  deleteChatMutation.variables?.chatId === chat.id;
                const bulkBusy = deleteAllChatsMutation.isPending;
                return (
                  <div key={chat.id} className="proj-chat-row-wrap">
                    <button
                      type="button"
                      className="proj-chat-row proj-chat-row-open"
                      onClick={() => navigate(`/projects/${selectedProjectId}/chat/${chat.id}`)}
                    >
                      <div className="proj-chat-row-main">
                        <span className="proj-chat-row-title">{chat.title}</span>
                        <span className="proj-chat-row-snippet">{chatSnippetLine(chat)}</span>
                      </div>
                    </button>
                    <div className="proj-chat-row-meta" role="group" aria-label={`Meta for ${chat.title}`}>
                      <time className="proj-chat-row-date" dateTime={chat.updatedAt}>
                        {formatChatHubDate(chat.updatedAt)}
                      </time>
                      <button
                        type="button"
                        className="ghost-btn ghost-btn-sm proj-chat-action-btn proj-chat-action-btn-danger proj-chat-row-delete"
                        disabled={deleteBusy || bulkBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteChat(chat.id, chat.title);
                        }}
                        title="Delete this chat only"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {!chatsQuery.data?.length ? <p className="muted proj-chat-list-empty">No chats yet.</p> : null}
            </div>
          </>
        ) : (
        <section className="workspace-list proj-sources-panel">
          {sourcesQuery.isLoading ? (
            <p className="muted">Loading repository sources...</p>
          ) : (
            <div className="source-sections">
              <CollapsibleSourceSection title={`Code Files (${sourcesQuery.data?.files.length ?? 0})`}>
                <div className="source-items source-tree-root">
                  <PathTreeView
                    node={codeFileTree}
                    depth={0}
                    renderLeaf={(file, depth, leafIndex) => (
                      <article
                        key={`${file.path}-${file.sha}-${leafIndex}`}
                        className="source-item source-tree-leaf"
                        style={{ marginLeft: depth * 14 }}
                      >
                        <div className="source-tree-leaf-main">
                          <strong>{pathBasename(file.path)}</strong>
                          <p className="muted source-tree-path" title={file.path}>
                            {file.path}
                          </p>
                          <p className="muted">
                            {(file.language ?? "text").toUpperCase()} · {formatBytes(file.sizeBytes)} ·{" "}
                            {file.sha.slice(0, 10)}
                          </p>
                        </div>
                        <span className="muted">{formatDate(file.updatedAt)}</span>
                      </article>
                    )}
                  />
                  {codeFileTree.dirs.size === 0 && codeFileTree.items.length === 0 ? (
                    <p className="muted">No files indexed.</p>
                  ) : null}
                </div>
              </CollapsibleSourceSection>

              <CollapsibleSourceSection title={`Docs (${sourcesQuery.data?.docs.length ?? 0})`}>
                <div className="source-items source-tree-root">
                  <PathTreeView
                    node={docsPathTree}
                    depth={0}
                    renderLeaf={(doc, depth, leafIndex) => (
                      <article
                        key={`doc-${doc.path ?? "x"}-${depth}-${leafIndex}`}
                        className="source-item source-tree-leaf"
                        style={{ marginLeft: depth * 14 }}
                      >
                        <div className="source-tree-leaf-main">
                          <strong>{doc.path ? pathBasename(doc.path) : "Doc chunk"}</strong>
                          {doc.path ? (
                            <p className="muted source-tree-path" title={doc.path}>
                              {doc.path}
                            </p>
                          ) : null}
                          <p className="muted">{truncateText(doc.chunkText, 150)}</p>
                        </div>
                        <span className="muted">{formatDate(doc.updatedAt)}</span>
                      </article>
                    )}
                  />
                  {docsPathTree.dirs.size === 0 && docsPathTree.items.length === 0 ? (
                    <p className="muted">No doc chunks.</p>
                  ) : null}
                </div>
              </CollapsibleSourceSection>

              <CollapsibleSourceSection title={`Issues (${sourcesQuery.data?.issues.length ?? 0})`}>
                <div className="source-items">
                  {(sourcesQuery.data?.issues ?? []).slice(0, 30).map((issue) => (
                    <article key={issue.githubIssueNumber} className="source-item">
                      <div>
                        <strong>
                          #{issue.githubIssueNumber} {issue.title}
                        </strong>
                        <p className="muted">
                          {issue.state} · {issue.author ?? "unknown"} · {truncateText(issue.body, 130)}
                        </p>
                      </div>
                      <span className="muted">{formatDate(issue.updatedAt)}</span>
                    </article>
                  ))}
                </div>
              </CollapsibleSourceSection>

              <CollapsibleSourceSection title={`Pull Requests (${sourcesQuery.data?.prs.length ?? 0})`}>
                <div className="source-items">
                  {(sourcesQuery.data?.prs ?? []).slice(0, 30).map((pr) => (
                    <article key={pr.githubPrNumber} className="source-item">
                      <div>
                        <strong>
                          #{pr.githubPrNumber} {pr.title}
                        </strong>
                        <p className="muted">
                          {pr.state} · {pr.author ?? "unknown"} · {truncateText(pr.body, 130)}
                        </p>
                      </div>
                      <span className="muted">{formatDate(pr.updatedAt)}</span>
                    </article>
                  ))}
                </div>
              </CollapsibleSourceSection>

              <CollapsibleSourceSection title={`Discussions (${sourcesQuery.data?.discussions.length ?? 0})`}>
                <div className="source-items">
                  {(sourcesQuery.data?.discussions ?? []).slice(0, 30).map((discussion) => (
                    <article key={discussion.githubDiscussionNumber} className="source-item">
                      <div>
                        <strong>
                          #{discussion.githubDiscussionNumber} {discussion.title}
                        </strong>
                        <p className="muted">
                          {discussion.category ?? "general"} · {truncateText(discussion.body, 130)}
                        </p>
                      </div>
                      <span className="muted">{formatDate(discussion.updatedAt)}</span>
                    </article>
                  ))}
                </div>
              </CollapsibleSourceSection>

              <CollapsibleSourceSection title={`Commits (${sourcesQuery.data?.commits.length ?? 0})`}>
                <div className="source-items">
                  {(sourcesQuery.data?.commits ?? []).slice(0, 50).map((commit) => (
                    <article key={commit.commitSha} className="source-item">
                      <div>
                        <strong>{commit.commitSha.slice(0, 10)}</strong>
                        <p className="muted">
                          {commit.author ?? "unknown"} · {truncateText(commit.message, 140)}
                        </p>
                      </div>
                      <span className="muted">{formatDate(commit.committedAt)}</span>
                    </article>
                  ))}
                </div>
              </CollapsibleSourceSection>
            </div>
          )}
        </section>
        )}
      </div>

      <details className="proj-sync-history">
        <summary className="proj-sync-history-summary">Sync history</summary>
        <div className="proj-sync-history-body">
          {(syncRunsQuery.data ?? []).map((run) => (
            <div key={run.id} className="proj-sync-history-row">
              <span className="proj-sync-history-status">{run.status}</span>
              <span className="muted proj-sync-history-time">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
          ))}
          {!syncRunsQuery.data?.length ? <p className="muted">No sync runs yet.</p> : null}
        </div>
      </details>

      <AiConnectModal
        open={showAiConnectModal}
        onClose={() => setShowAiConnectModal(false)}
      />
    </section>
  );
}

function formatChatHubDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString(undefined, opts);
}

function chatSnippetLine(chat: { lastPreview?: string | null; title: string }) {
  const raw = chat.lastPreview?.trim();
  if (!raw) {
    return "No messages yet.";
  }
  return raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
}

function generateChatTitle(input: string, existingCount: number): string {
  const normalized = input
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s\-_.]/gu, "")
    .trim();
  if (!normalized) {
    return `Chat ${existingCount + 1}`;
  }

  const words = normalized.split(" ").filter(Boolean).slice(0, 6);
  return words.join(" ");
}

type SourceRepoFile = {
  path: string;
  sha: string;
  language?: string | null;
  sizeBytes: number;
  updatedAt: string;
};

type SourceDocRow = {
  path?: string | null;
  updatedAt: string;
  chunkText: string;
};

type DirNode<T> = {
  dirs: Map<string, DirNode<T>>;
  items: T[];
};

function emptyDirNode<T>(): DirNode<T> {
  return { dirs: new Map(), items: [] };
}

function insertByPath<T>(root: DirNode<T>, rawPath: string | null | undefined, item: T, fallback = "Other") {
  const normalized = (rawPath ?? fallback).replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    root.items.push(item);
    return;
  }
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i]!;
    if (!cur.dirs.has(seg)) {
      cur.dirs.set(seg, emptyDirNode());
    }
    cur = cur.dirs.get(seg)!;
  }
  cur.items.push(item);
}

function pathBasename(full: string) {
  const parts = full.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? full;
}

function treeLeafFragmentKey(item: unknown, depth: number, leafIndex: number) {
  if (item && typeof item === "object" && "path" in item) {
    const p = (item as { path?: string | null }).path;
    if (typeof p === "string" && p.length > 0) {
      return `${p}@${depth}#${leafIndex}`;
    }
  }
  if (item && typeof item === "object" && "sha" in item && typeof (item as { sha?: string }).sha === "string") {
    return `sha:${(item as { sha: string }).sha}@${depth}#${leafIndex}`;
  }
  return `leaf-${depth}-${leafIndex}`;
}

function SourceTreeFolder({ name, children }: { name: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`source-tree-dir ${open ? "source-tree-dir-open" : ""}`}>
      <button
        type="button"
        className="source-tree-dir-summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {name}
      </button>
      {open ? <div className="source-tree-dir-body">{children}</div> : null}
    </div>
  );
}

function PathTreeView<T>({
  node,
  depth,
  renderLeaf,
}: {
  node: DirNode<T>;
  depth: number;
  renderLeaf: (item: T, depth: number, leafIndex: number) => ReactNode;
}) {
  const dirKeys = [...node.dirs.keys()].sort((a, b) => a.localeCompare(b));
  const sortedItems = [...node.items].sort((a, b) => {
    const pa =
      typeof a === "object" && a && "path" in a && typeof (a as { path?: string }).path === "string"
        ? (a as { path: string }).path
        : "";
    const pb =
      typeof b === "object" && b && "path" in b && typeof (b as { path?: string }).path === "string"
        ? (b as { path: string }).path
        : "";
    return pa.localeCompare(pb);
  });

  if (dirKeys.length === 0 && sortedItems.length === 0) {
    return null;
  }

  return (
    <>
      {dirKeys.map((dirName) => (
        <SourceTreeFolder key={`${depth}-${dirName}`} name={dirName}>
          <PathTreeView node={node.dirs.get(dirName)!} depth={depth + 1} renderLeaf={renderLeaf} />
        </SourceTreeFolder>
      ))}
      {sortedItems.map((item, leafIndex) => (
        <Fragment key={treeLeafFragmentKey(item, depth, leafIndex)}>{renderLeaf(item, depth, leafIndex)}</Fragment>
      ))}
    </>
  );
}

function CollapsibleSourceSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`source-section-details ${open ? "source-section-details-open" : ""}`}>
      <button
        type="button"
        className="source-section-summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {title}
      </button>
      {open ? <div className="source-section-body">{children}</div> : null}
    </div>
  );
}

function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) {
    return "No description";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function isAiConfigured(
  settings:
    | {
        providerType: string;
        apiKey?: string;
        modelName: string;
        embeddingModel: string;
      }
    | null
    | undefined,
) {
  if (!settings) {
    return false;
  }
  const provider = settings.providerType;
  const hasModels =
    Boolean(settings.modelName?.trim()) &&
    Boolean(settings.embeddingModel?.trim());
  if (!hasModels) {
    return false;
  }
  if (provider === "ollama") {
    return true;
  }
  return Boolean(settings.apiKey?.trim());
}
