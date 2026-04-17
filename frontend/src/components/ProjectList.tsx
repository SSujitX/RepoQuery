import { useNavigate } from "react-router-dom";
import { useProjectStore } from "../features/projects/project-store";
import type { ProjectModel } from "../types/app";
import { SyncStatusBadge } from "./SyncStatusBadge";

type Props = {
  projects: ProjectModel[];
  onDeleteProject: (projectId: string) => Promise<unknown>;
};

export function ProjectList({ projects, onDeleteProject }: Props) {
  const navigate = useNavigate();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);

  return (
    <div className="project-list">
      {projects.map((project) => (
        <article
          key={project.id}
          className={`project-item ${currentProjectId === project.id ? "project-item-active" : ""}`}
        >
          <button
            type="button"
            className="project-item-main"
            onClick={() => {
              setCurrentProjectId(project.id);
              void navigate(`/projects/${project.id}`);
            }}
          >
            <div className="project-item-text">
              <strong className="project-item-title">{project.name}</strong>
              <p className="muted project-item-meta">
                {project.repoOwner}/{project.repoName}
              </p>
            </div>
            <SyncStatusBadge status={project.status} />
          </button>

          <button
            type="button"
            className="project-delete-btn"
            title="Delete project"
            aria-label={`Delete ${project.name}`}
            onClick={() => {
              const confirmDelete = window.confirm(
                `Delete project "${project.name}"? This removes chats and indexed data.`,
              );
              if (!confirmDelete) {
                return;
              }
              void onDeleteProject(project.id);
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h.3l.9 11.1A2 2 0 0 0 8.2 20h7.6a2 2 0 0 0 2-1.9L18.7 7H19a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 2V5h2V5h-2Zm-2.7 2h7.4l-.9 11H9.2L8.3 7Z"
              />
            </svg>
          </button>
        </article>
      ))}
    </div>
  );
}
