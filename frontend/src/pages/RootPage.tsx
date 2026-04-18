import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { applyProjectDeleted } from "../features/projects/delete-project-cache";
import { useProjectStore } from "../features/projects/project-store";
import { apiClient } from "../api/client";

export function RootPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);
  const setCurrentChatId = useProjectStore((state) => state.setCurrentChatId);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: apiClient.getProjects,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: apiClient.deleteProject,
    onSuccess: (_, deletedProjectId) => {
      applyProjectDeleted(
        queryClient,
        deletedProjectId,
        projectsQuery.data,
        useProjectStore.getState(),
        navigate,
        location.pathname,
      );
    },
  });

  useEffect(() => {
    const list = projectsQuery.data;
    if (!list) {
      return;
    }
    if (list.length === 0) {
      setCurrentProjectId(null);
      setCurrentChatId(null);
      return;
    }
    setCurrentProjectId(null);
    setCurrentChatId(null);
  }, [projectsQuery.data, setCurrentChatId, setCurrentProjectId]);

  if (projectsQuery.isLoading) {
    return (
      <section className="home-overview home-overview--narrow">
        <p className="muted home-overview-loading">Loading projects…</p>
      </section>
    );
  }

  const projects = projectsQuery.data ?? [];

  if (projects.length === 0) {
    return (
      <section className="home-overview home-overview--narrow home-overview--empty panel">
        <h2>No projects yet</h2>
        <p className="muted">Create your first project from the sidebar.</p>
      </section>
    );
  }

  return (
    <section className="home-overview">
      <div className="home-overview-head">
        <h1 className="workspace-title home-overview-title">Projects</h1>
        <p className="muted home-overview-sub">
          Choose a repository workspace to chat, sync, and browse sources.
        </p>
      </div>
      <ul className="home-project-list" aria-label="All projects">
        {projects.map((project) => (
          <li key={project.id} className="home-project-wrap">
            <button
              type="button"
              className="home-project-row"
              onClick={() => {
                setCurrentProjectId(project.id);
                void navigate(`/projects/${project.id}`);
              }}
            >
              <span className="home-project-row-inner">
                <span className="home-project-row-main">
                  <span className="home-project-row-title">{project.name}</span>
                  <span className="home-project-row-slug">
                    {project.repoOwner}/{project.repoName}
                  </span>
                  <p className="home-project-row-url" title={project.repoUrl}>
                    {project.repoUrl}
                  </p>
                  <p className="home-project-row-branch">Branch: {project.defaultBranch}</p>
                </span>
                <SyncStatusBadge status={project.status} />
              </span>
            </button>
            <button
              type="button"
              className="project-delete-btn home-project-delete-btn"
              title="Delete project"
              aria-label={`Delete ${project.name}`}
              disabled={deleteProjectMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                const confirmDelete = window.confirm(
                  `Delete project "${project.name}"? This removes chats and indexed data.`,
                );
                if (!confirmDelete) {
                  return;
                }
                void deleteProjectMutation.mutateAsync(project.id);
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h.3l.9 11.1A2 2 0 0 0 8.2 20h7.6a2 2 0 0 0 2-1.9L18.7 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2V5h2V5h-2Zm-2.7 2h7.4l-.9 11H9.2L8.3 7Z"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
