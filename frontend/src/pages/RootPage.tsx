import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { useProjectStore } from "../features/projects/project-store";
import { apiClient } from "../api/client";

export function RootPage() {
  const navigate = useNavigate();
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);
  const setCurrentChatId = useProjectStore((state) => state.setCurrentChatId);
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: apiClient.getProjects,
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
    return <p>Loading projects...</p>;
  }

  const projects = projectsQuery.data ?? [];

  if (projects.length === 0) {
    return (
      <section className="panel">
        <h2>No projects yet</h2>
        <p className="muted">Create your first project from the left sidebar.</p>
      </section>
    );
  }

  return (
    <section className="home-overview">
      <div className="home-overview-head">
        <h1 className="workspace-title" style={{ margin: 0 }}>
          Projects
        </h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Choose a repository workspace to chat, sync, and browse sources.
        </p>
      </div>
      <ul className="home-project-list" aria-label="All projects">
        {projects.map((project) => (
          <li key={project.id}>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
