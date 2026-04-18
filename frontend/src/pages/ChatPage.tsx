import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { AiConnectModal } from "../components/AiConnectModal";
import { ChatWindow } from "../components/ChatWindow";
import { ProjectHeader } from "../components/ProjectHeader";
import { useProjectStore } from "../features/projects/project-store";
import type { MessageModel } from "../types/app";

type ChatLocationState = {
  initialMessage?: string;
};

export function ChatPage() {
  const { projectId: routeProjectId = "", chatId = "" } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);
  const projectId = routeProjectId;
  const initialMsg = ((location.state as ChatLocationState | null)?.initialMessage ?? "").trim();
  const [sendError, setSendError] = useState<string | null>(null);
  const [showAiConnectModal, setShowAiConnectModal] = useState(false);
  /** Assistant count when a send starts; kept across settles so overlapping sends do not clear it. */
  const sendBaselineAssistantCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (routeProjectId && routeProjectId !== currentProjectId) {
      setCurrentProjectId(routeProjectId);
    }
  }, [routeProjectId, currentProjectId, setCurrentProjectId]);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiClient.getProject(projectId),
    enabled: Boolean(projectId),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => apiClient.getMessages(chatId),
    enabled: Boolean(chatId),
    refetchInterval: 5000,
  });

  const chatQuery = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => apiClient.getChat(chatId),
    enabled: Boolean(chatId),
  });

  const projectStatusQuery = useQuery({
    queryKey: ["project-status", projectId],
    queryFn: () => apiClient.getProjectStatus(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      if (st === "syncing" || st === "refreshing") {
        return 1000;
      }
      return false;
    },
  });

  const [syncError, setSyncError] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => apiClient.syncProject(projectId),
    onMutate: () => {
      setSyncError(null);
      void queryClient.invalidateQueries({ queryKey: ["project-status", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-status", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-sync-runs", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-sources", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => {
      setSyncError(e?.message || "Sync failed");
    },
  });

  useEffect(() => {
    if (!projectId || !syncMutation.isPending) {
      return;
    }
    const id = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["project-status", projectId] });
    }, 1000);
    return () => window.clearInterval(id);
  }, [syncMutation.isPending, projectId, queryClient]);

  const messageMutation = useMutation({
    mutationFn: (content: string) => apiClient.createMessage(chatId, content),
    onMutate: () => {
      const data = queryClient.getQueryData<MessageModel[]>(["messages", chatId]) ?? [];
      sendBaselineAssistantCountRef.current = data.filter((m) => m.role === "assistant").length;
    },
    onSuccess: () => {
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
    onError: (error: Error) => {
      const lowered = error.message.toLowerCase();
      if (lowered.includes("ai provider is not configured") || lowered.includes("ai api key is missing")) {
        setSendError("Connect AI in Settings before chatting.");
        setShowAiConnectModal(true);
        return;
      }
      setSendError(error.message || "Message failed to send.");
    },
  });

  const sendMessage = useCallback(
    (content: string) => messageMutation.mutateAsync(content).then(() => undefined),
    [messageMutation],
  );

  // Rules of Hooks: all hooks must stay above conditional returns. A `useCallback` (or any hook)
  // placed after `if (isLoading) return …` runs fewer times on early renders → fatal React error.
  useEffect(() => {
    if (!chatId || !initialMsg) {
      return;
    }
    const key = `rp_chat_init_${chatId}`;
    if (sessionStorage.getItem(key)) {
      return;
    }
    sessionStorage.setItem(key, "1");
    void navigate(location.pathname, { replace: true, state: {} });
    void messageMutation.mutateAsync(initialMsg).catch(() => {
      // Do not clear sessionStorage on error. If the API hits a 60s timeout,
      // it throws here. Clearing it triggers a recursive infinite retry loop!
    });
  }, [chatId, initialMsg, location.pathname, navigate, messageMutation]);

  /* No hooks below: conditional returns only from here down. */
  if (!projectId || !chatId) {
    return <p className="muted">Invalid chat link.</p>;
  }

  // Use `isLoading` (v5: `isPending && isFetching`), not `isPending`: when `enabled` is false, the query
  // stays `pending` + `fetchStatus: idle` forever — `isPending` alone would show loading indefinitely.
  if (projectQuery.isLoading) {
    return <p className="muted">Loading project…</p>;
  }

  if (projectQuery.isError) {
    const detail =
      projectQuery.error instanceof Error ? projectQuery.error.message : "Request failed";
    return (
      <section className="stack chat-page chat-page-gpt">
        <p className="error-text">
          Could not load this project. Check the URL or confirm the API is running. {detail}
        </p>
      </section>
    );
  }

  if (!projectQuery.data) {
    return <p className="muted">Project not found.</p>;
  }

  const messagesError =
    messagesQuery.isError && messagesQuery.error instanceof Error
      ? messagesQuery.error.message
      : messagesQuery.isError
        ? "Could not load messages for this chat."
        : null;

  const messages = messagesQuery.data ?? [];
  const pendingVars = messageMutation.isPending ? messageMutation.variables : undefined;
  /*
   * Avoid duplicate user bubble: `refetchInterval` can load user+assistant from the DB while the
   * long-running `createMessage` HTTP call is still pending. The last row is then the assistant, so
   * checking only "last message === user" misses the case and we render `pendingUserContent` again.
   */
  const last = messages[messages.length - 1];
  const prev = messages.length >= 2 ? messages[messages.length - 2] : undefined;
  const pendingAlreadyInThread =
    pendingVars &&
    ((last?.role === "assistant" &&
      prev?.role === "user" &&
      prev.content === pendingVars) ||
      (last?.role === "user" && last.content === pendingVars));
  const pendingUserContent =
    pendingVars && !pendingAlreadyInThread ? pendingVars : null;

  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const baselineAssistants = sendBaselineAssistantCountRef.current;
  const newAssistantAlreadyFetched =
    messageMutation.isPending &&
    baselineAssistants !== null &&
    assistantCount > baselineAssistants;
  const awaitingAssistant = messageMutation.isPending && !newAssistantAlreadyFetched;

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

  return (
    <section className="stack chat-page chat-page-gpt">
      <ProjectHeader
        variant="chat"
        project={projectForHeader}
        syncPending={syncMutation.isPending}
        onRefresh={() => syncMutation.mutateAsync()}
      />
      {syncError ? <p className="error-text chat-page-sync-error">{syncError}</p> : null}
      {liveSync ? (
        <section className="sync-progress-card chat-page-sync-progress" aria-live="polite">
          <div className="sync-progress-head">
            <span className="muted">Repository sync</span>
            <span className="sync-progress-pct">{syncPercent}%</span>
          </div>
          <div
            className="sync-progress-bar"
            role="progressbar"
            aria-valuenow={syncPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="sync-progress-bar-fill" style={{ width: `${Math.min(100, syncPercent)}%` }} />
          </div>
          <p className="sync-progress-message">{syncMessage}</p>
          {syncRun?.phase ? (
            <p className="muted chat-page-sync-phase">
              Step: {syncRun.phase}
            </p>
          ) : null}
          {syncRun?.logs?.length ? (
            <pre className="sync-progress-logs">{syncRun.logs.join("\n")}</pre>
          ) : null}
        </section>
      ) : null}
      <ChatWindow
        threadKey={chatId}
        chatTitle={chatQuery.data?.title ?? null}
        messages={messages}
        errorText={sendError}
        onSend={sendMessage}
        pendingUserContent={pendingUserContent}
        awaitingAssistant={awaitingAssistant}
        sendBlocked={messageMutation.isPending}
        messagesInitialLoading={messagesQuery.isLoading}
        messagesError={messagesError}
      />
      <AiConnectModal open={showAiConnectModal} onClose={() => setShowAiConnectModal(false)} />
    </section>
  );
}
