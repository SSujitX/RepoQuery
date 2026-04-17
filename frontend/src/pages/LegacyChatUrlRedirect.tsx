import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../api/client";

/** Old `/projects/chats/:chatId` → `/projects/:projectId/chat/:chatId`. */
export function LegacyChatUrlRedirect() {
  const { chatId = "" } = useParams();
  const navigate = useNavigate();
  const chatQuery = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => apiClient.getChat(chatId),
    enabled: Boolean(chatId),
  });

  useEffect(() => {
    const chat = chatQuery.data;
    if (!chat) {
      return;
    }
    void navigate(`/projects/${chat.projectId}/chat/${chat.id}`, { replace: true });
  }, [chatQuery.data, navigate]);

  if (chatQuery.isError) {
    return <p className="muted">Chat not found.</p>;
  }

  return <p className="muted">Redirecting…</p>;
}
