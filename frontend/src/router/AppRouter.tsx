import { Navigate, Route, Routes } from "react-router-dom";
import { RootPage } from "../pages/RootPage";
import { ProjectDashboardPage } from "../pages/ProjectDashboardPage";
import { ChatPage } from "../pages/ChatPage";
import { SettingsPage } from "../pages/SettingsPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootPage />} />
      <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
      <Route path="/projects/:projectId/chat/:chatId" element={<ChatPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
