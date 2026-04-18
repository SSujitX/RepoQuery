import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { Sidebar } from "../components/Sidebar";
import { applyProjectDeleted } from "../features/projects/delete-project-cache";
import { useProjectStore } from "../features/projects/project-store";
import { useMediaQuery } from "../hooks/useMediaQuery";

const SIDEBAR_COLLAPSED_KEY = "repoquery-sidebar-collapsed";
const MOBILE_NAV_QUERY = "(max-width: 768px)";

export function AppShell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobileNav = useMediaQuery(MOBILE_NAV_QUERY);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNav) {
      setMobileNavOpen(false);
    }
  }, [isMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen || !isMobileNav) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen, isMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

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

  const layoutClass = [
    "layout",
    sidebarCollapsed ? "layout--sidebar-collapsed" : "",
    isMobileNav && mobileNavOpen ? "layout--mobile-nav-open" : "",
    isMobileNav ? "layout--mobile" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClass}>
      {isMobileNav && mobileNavOpen ? (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      {isMobileNav && !mobileNavOpen ? (
        <button
          type="button"
          className="mobile-nav-open-btn"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
          </svg>
        </button>
      ) : null}
      <Sidebar
        collapsed={isMobileNav ? false : sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        projects={projectsQuery.data ?? []}
        projectsLoading={projectsQuery.isLoading}
        onCreateProject={(payload) => createProjectMutation.mutateAsync(payload)}
        onDeleteProject={(projectId) => deleteProjectMutation.mutateAsync(projectId)}
        isMobileDrawer={isMobileNav}
        onCloseDrawer={() => setMobileNavOpen(false)}
      />
      <main className={`content${isMobileNav ? " content--mobile-pad" : ""}`}>
        <div className="content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
