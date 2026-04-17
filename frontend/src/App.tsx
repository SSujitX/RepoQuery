import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { ChatPage } from "./pages/ChatPage";
import { LegacyChatUrlRedirect } from "./pages/LegacyChatUrlRedirect";
import { LegacyScopedChatPathRedirect } from "./pages/LegacyScopedChatPathRedirect";
import { ProjectDashboardPage } from "./pages/ProjectDashboardPage";
import { ProjectsLandingRedirect } from "./pages/ProjectsLandingRedirect";
import { RootPage } from "./pages/RootPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<RootPage />} />
          <Route path="/projects/chats/:chatId" element={<LegacyChatUrlRedirect />} />
          <Route path="/projects/:projectId/chats/:chatId" element={<LegacyScopedChatPathRedirect />} />
          <Route path="/projects/:projectId/chat/:chatId" element={<ChatPage />} />
          <Route path="/projects/:projectId" element={<ProjectDashboardPage />} />
          <Route path="/projects" element={<ProjectsLandingRedirect />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
