import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useProjectStore } from "../features/projects/project-store";

/** `/projects` → `/projects/:projectId` when the store points at a valid project, otherwise home. */
export function ProjectsLandingRedirect() {
  const navigate = useNavigate();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: apiClient.getProjects,
  });

  useEffect(() => {
    if (projectsQuery.isLoading || !projectsQuery.data) {
      return;
    }
    const list = projectsQuery.data;
    if (currentProjectId && list.some((p) => p.id === currentProjectId)) {
      void navigate(`/projects/${currentProjectId}`, { replace: true });
      return;
    }
    void navigate("/", { replace: true });
  }, [projectsQuery.isLoading, projectsQuery.data, currentProjectId, navigate]);

  return <p className="muted">Opening workspace…</p>;
}
