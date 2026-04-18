import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import type { ProjectModel } from "../../types/app";

export type ProjectStoreSlice = {
  currentProjectId: string | null;
  setCurrentChatId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
};

/**
 * Shared cache + selection updates after a project is deleted (AppShell + RootPage).
 */
export function applyProjectDeleted(
  queryClient: QueryClient,
  deletedProjectId: string,
  projectsSnapshot: ProjectModel[] | undefined,
  store: ProjectStoreSlice,
  navigate: NavigateFunction,
  pathname: string,
): void {
  const selectedId = store.currentProjectId;
  const previous = queryClient.getQueryData<ProjectModel[]>(["projects"]) ?? projectsSnapshot ?? [];
  const remaining = previous.filter((p) => p.id !== deletedProjectId);
  queryClient.setQueryData(["projects"], remaining);

  queryClient.removeQueries({ queryKey: ["project", deletedProjectId] });
  queryClient.removeQueries({ queryKey: ["project-status", deletedProjectId] });
  queryClient.removeQueries({ queryKey: ["project-chats", deletedProjectId] });
  queryClient.removeQueries({ queryKey: ["project-sync-runs", deletedProjectId] });
  queryClient.removeQueries({ queryKey: ["project-sources", deletedProjectId] });
  queryClient.removeQueries({ queryKey: ["messages"] });

  const deletedWasSelected = selectedId === deletedProjectId;
  const selectionInvalid = Boolean(selectedId) && !remaining.some((p) => p.id === selectedId);

  if (deletedWasSelected || selectionInvalid) {
    store.setCurrentChatId(null);
    store.setCurrentProjectId(remaining[0]?.id ?? null);
    if (/^\/projects\//.test(pathname)) {
      if (remaining[0]) {
        navigate(`/projects/${remaining[0].id}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }

  void queryClient.invalidateQueries({ queryKey: ["projects"] });
}
