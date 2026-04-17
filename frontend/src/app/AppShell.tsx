import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { Sidebar } from "../components/Sidebar";
import { useProjectStore } from "../features/projects/project-store";
import type { ProjectModel } from "../types/app";

const SIDEBAR_COLLAPSED_KEY = "repoquery-sidebar-collapsed";

export function AppShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: apiClient.getProjects,
  });

  const createProjectMutation = useMutation({
    mutationFn: apiClient.createProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

  const deleteProjectMutation = useMutation({
    mutationFn: apiClient.deleteProject,
    onSuccess: (_, deletedProjectId) => {
      const store = useProjectStore.getState();
      const selectedId = store.currentProjectId;

      const previous =
        queryClient.getQueryData<ProjectModel[]>(["projects"]) ?? projectsQuery.data ?? [];
      const remaining = previous.filter((p) => p.id !== deletedProjectId);
      queryClient.setQueryData(["projects"], remaining);

      queryClient.removeQueries({ queryKey: ["project", deletedProjectId] });
      queryClient.removeQueries({ queryKey: ["project-status", deletedProjectId] });
      queryClient.removeQueries({ queryKey: ["project-chats", deletedProjectId] });
      queryClient.removeQueries({ queryKey: ["project-sync-runs", deletedProjectId] });
      queryClient.removeQueries({ queryKey: ["project-sources", deletedProjectId] });
      queryClient.removeQueries({ queryKey: ["messages"] });

      const deletedWasSelected = selectedId === deletedProjectId;
      const selectionInvalid =
        Boolean(selectedId) && !remaining.some((p) => p.id === selectedId);

      if (deletedWasSelected || selectionInvalid) {
        store.setCurrentChatId(null);
        store.setCurrentProjectId(remaining[0]?.id ?? null);
        if (/^\/projects\//.test(location.pathname)) {
          if (remaining[0]) {
            navigate(`/projects/${remaining[0].id}`, { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <div className={`layout${sidebarCollapsed ? " layout--sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        projects={projectsQuery.data ?? []}
        projectsLoading={projectsQuery.isLoading}
        onCreateProject={(payload) => createProjectMutation.mutateAsync(payload)}
        onDeleteProject={(projectId) => deleteProjectMutation.mutateAsync(projectId)}
      />
      <main className="content">
        <div className="content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
