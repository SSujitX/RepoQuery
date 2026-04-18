import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ProjectModel } from "../types/app";
import { NewProjectModal } from "./NewProjectModal";
import { ProjectList } from "./ProjectList";

type Props = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  projects: ProjectModel[];
  /** First fetch of the projects list (sidebar would otherwise show “No projects yet” while loading). */
  projectsLoading?: boolean;
  onCreateProject: (payload: {
    name: string;
    repoUrl: string;
    branch?: string;
    description?: string;
  }) => Promise<unknown>;
  onDeleteProject: (projectId: string) => Promise<unknown>;
  /** Narrow screens: sidebar is a slide-over drawer. */
  isMobileDrawer?: boolean;
  onCloseDrawer?: () => void;
};

function filterProjects(projects: ProjectModel[], query: string): ProjectModel[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return projects;
  }
  return projects.filter((p) => {
    const hay = `${p.name} ${p.repoOwner} ${p.repoName} ${p.repoUrl}`.toLowerCase();
    return hay.includes(q);
  });
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  projects,
  projectsLoading = false,
  onCreateProject,
  onDeleteProject,
  isMobileDrawer = false,
  onCloseDrawer,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = useMemo(
    () => filterProjects(projects, searchQuery),
    [projects, searchQuery],
  );

  const searchTrimmed = searchQuery.trim();
  const emptySearch = searchTrimmed.length > 0 && filteredProjects.length === 0;
  const noProjectsYet =
    projects.length === 0 && searchTrimmed.length === 0 && !projectsLoading;

  const brandLink = (
    <Link
      className={`sidebar-brand${collapsed ? " sidebar-brand--icon-only" : " sidebar-brand--in-row"}`}
      to="/"
      title={collapsed ? "Home" : undefined}
      aria-label={collapsed ? "Home" : undefined}
    >
      <span className="sidebar-brand-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1.2 5.5a4.8 4.8 0 0 1 4.8 4.8v3.7a1 1 0 0 1-1 1h-1.7a1 1 0 0 1-1-1v-3.7a1.1 1.1 0 1 0-2.2 0v3.7a1 1 0 0 1-1 1H9.4a1 1 0 0 1-1-1v-3.7a3.8 3.8 0 0 1 3.8-3.8Z"
          />
        </svg>
      </span>
      {!collapsed ? <span className="sidebar-brand-text">RepoQuery</span> : null}
    </Link>
  );

  const collapseBtn = (
    <button
      type="button"
      className="sidebar-collapse-btn"
      onClick={onToggleCollapsed}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9 6a1 1 0 0 0-1 1v10a1 1 0 0 0 1.55.83l7-5a1 1 0 0 0 0-1.66l-7-5A1 1 0 0 0 9 6Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M15 6a1 1 0 0 1 1 1v10a1 1 0 0 1-1.55.83l-7-5a1 1 0 0 1 0-1.66l7-5A1 1 0 0 1 15 6Z"
          />
        </svg>
      )}
    </button>
  );

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}${isMobileDrawer ? " sidebar--drawer" : ""}`}>
      {isMobileDrawer ? (
        <div className="sidebar-drawer-top">
          <span className="sidebar-drawer-title">Menu</span>
          <button
            type="button"
            className="sidebar-drawer-close"
            onClick={onCloseDrawer}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M18.3 5.71 12.66 11.36l5.65 5.65-1.41 1.41L11.24 12.77 5.6 18.41 4.18 17l5.65-5.65L4.18 5.71 5.6 4.29l5.64 5.64 5.64-5.64 1.42 1.42Z"
              />
            </svg>
          </button>
        </div>
      ) : null}
      <div className={`sidebar-brand-row${collapsed ? " sidebar-brand-row--collapsed" : ""}`}>
        {collapsed ? (
          <>
            {collapseBtn}
            {brandLink}
          </>
        ) : (
          <>
            {brandLink}
            {collapseBtn}
          </>
        )}
      </div>

      <button
        className="sidebar-new-btn"
        type="button"
        onClick={() => setShowModal(true)}
        title="New project"
        aria-label="New project"
      >
        {collapsed ? (
          <span className="sidebar-new-btn-icon" aria-hidden="true">
            +
          </span>
        ) : (
          "+ New project"
        )}
      </button>

      {!collapsed ? (
        <>
          <div className="sidebar-section-title">Projects</div>
          <label className="sidebar-search">
            <span className="sr-only">Search projects</span>
            <input
              type="search"
              className="sidebar-search-input"
              placeholder="Search projects…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="sidebar-scroll">
            {emptySearch ? (
              <p className="muted sidebar-empty-hint">No projects match your search.</p>
            ) : projectsLoading && projects.length === 0 ? (
              <p className="muted sidebar-empty-hint">Loading projects…</p>
            ) : noProjectsYet ? (
              <p className="muted sidebar-empty-hint">No projects yet.</p>
            ) : (
              <ProjectList projects={filteredProjects} onDeleteProject={onDeleteProject} />
            )}
          </div>
        </>
      ) : null}

      <div className="sidebar-footer">
        <Link
          className={`sidebar-footer-link${collapsed ? " sidebar-footer-link--icon" : ""}`}
          to="/settings"
          title="Settings"
          aria-label="Settings"
        >
          {collapsed ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 15.5A3.5 3.5 0 1 0 8.5 12 3.5 3.5 0 0 0 12 15.5Zm7.43-2.53c.04-.32.07-.66.07-1s-.03-.68-.07-1l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.99s.03.68.07 1l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65Z"
              />
            </svg>
          ) : (
            "Settings"
          )}
        </Link>
      </div>
      <NewProjectModal open={showModal} onClose={() => setShowModal(false)} onCreate={onCreateProject} />
    </aside>
  );
}
