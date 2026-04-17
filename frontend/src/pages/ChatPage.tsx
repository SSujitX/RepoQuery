import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { AiConnectModal } from "../components/AiConnectModal";
import { ChatWindow } from "../components/ChatWindow";
import { ProjectHeader } from "../components/ProjectHeader";
import { useProjectStore } from "../features/projects/project-store";

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

  const syncMutation = useMutation({
    mutationFn: () => apiClient.syncProject(projectId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const messageMutation = useMutation({
    mutationFn: (content: string) => apiClient.createMessage(chatId, content),
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

  return (
    <section className="stack chat-page chat-page-gpt">
      <ProjectHeader
        variant="chat"
        project={projectQuery.data}
        onRefresh={() => syncMutation.mutateAsync()}
      />
      <ChatWindow
        messages={messages}
        errorText={sendError}
        onSend={sendMessage}
        pendingUserContent={pendingUserContent}
        awaitingAssistant={messageMutation.isPending}
        messagesInitialLoading={messagesQuery.isLoading}
        messagesError={messagesError}
      />
      <AiConnectModal open={showAiConnectModal} onClose={() => setShowAiConnectModal(false)} />
    </section>
  );
}
