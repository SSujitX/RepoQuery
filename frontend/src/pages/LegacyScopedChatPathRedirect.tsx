import { Navigate, useParams } from "react-router-dom";

/** Old `/projects/:projectId/chats/:chatId` → `/projects/:projectId/chat/:chatId`. */
export function LegacyScopedChatPathRedirect() {
  const { projectId = "", chatId = "" } = useParams();
  return <Navigate to={`/projects/${projectId}/chat/${chatId}`} replace />;
}
