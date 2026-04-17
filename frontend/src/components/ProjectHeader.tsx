import { Link } from "react-router-dom";
import type { ProjectModel } from "../types/app";
import { SyncStatusBadge } from "./SyncStatusBadge";

type Props = {
  project: ProjectModel;
  onRefresh: () => Promise<unknown>;
  /** Compact strip used on the full-page chat layout */
  variant?: "default" | "chat" | "hub";
};

function FolderIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="workspace-hub-folder-svg" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2Z"
      />
    </svg>
  );
}

export function ProjectHeader({ project, onRefresh, variant = "default" }: Props) {
  const chat = variant === "chat";
  const hub = variant === "hub";

  if (hub) {
    return (
      <header className="workspace-header workspace-header--hub">
        <div className="hub-compact-left">
          <span className="hub-compact-icon" aria-hidden>
            <FolderIcon size={17} />
          </span>
          <div className="hub-compact-text">
            <h1 className="hub-compact-name">{project.name}</h1>
            <p className="hub-compact-meta muted">
              {project.defaultBranch}
              <span className="hub-compact-meta-sep"> · </span>
              <span className="hub-compact-repo" title={project.repoUrl}>
                {project.repoUrl.replace(/^https?:\/\//, "")}
              </span>
            </p>
          </div>
        </div>
        <div className="hub-compact-actions">
          <SyncStatusBadge status={project.status} />
          <button type="button" className="ghost-btn ghost-btn-sm" onClick={() => void onRefresh()}>
            Sync
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className={`workspace-header ${chat ? "workspace-header--chat" : ""}`}>
      <div className="workspace-header-titles">
        {chat ? (
          <Link to={`/projects/${project.id}`} className="chat-back-link">
            ← Workspace
          </Link>
        ) : null}
        <div>
          <h1 className="workspace-title">{project.name}</h1>
          {chat ? (
            <p className="muted workspace-subtitle workspace-subtitle-chat">{project.repoUrl}</p>
          ) : (
            <>
              <p className="muted workspace-subtitle">{project.repoUrl}</p>
              <p className="muted workspace-subtitle">Branch: {project.defaultBranch}</p>
            </>
          )}
        </div>
      </div>
      <div className="stack-right">
        <SyncStatusBadge status={project.status} />
        <button type="button" className="ghost-btn" onClick={() => void onRefresh()}>
          {chat ? "Sync" : "Refresh Project"}
        </button>
      </div>
    </header>
  );
}
