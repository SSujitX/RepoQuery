import { useEffect, useRef, useState } from "react";
import { apiClient } from "../api/client";

type Props = {
  onSubmit: (payload: {
    name: string;
    repoUrl: string;
    branch?: string;
    description?: string;
  }) => Promise<unknown>;
};

function isGitHubRepoUrl(value: string): boolean {
  return canonicalRepoUrl(value) !== null;
}

/** owner/repo for dedupe and stable preview identity */
function canonicalRepoUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  const withProto =
    raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    const url = new URL(withProto);
    if (!url.hostname.endsWith("github.com")) {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    return `${segments[0]}/${segments[1]}`.toLowerCase();
  } catch {
    return null;
  }
}

function formatPreviewError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("403") ||
    lower.includes("429") ||
    lower.includes("abuse")
  ) {
    return "GitHub rate limit reached (anonymous API is very small). Add a personal access token under Settings → GitHub, save, then try again. You can also wait a few minutes.";
  }
  return raw || "Failed to fetch repository details.";
}

const PREVIEW_DEBOUNCE_MS = 900;

export function RepoInputForm({ onSubmit }: Props) {
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingRepo, setFetchingRepo] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [repoLoaded, setRepoLoaded] = useState(false);
  /** Canonical owner/repo we already successfully previewed (skip duplicate requests). */
  const previewDoneForRepoRef = useRef<string>("");

  useEffect(() => {
    const url = repoUrl.trim();
    let cancelled = false;

    if (!url) {
      setRepoLoaded(false);
      setDefaultBranch("");
      setBranches([]);
      setFetchError(null);
      previewDoneForRepoRef.current = "";
      return undefined;
    }

    const canonical = canonicalRepoUrl(url);
    if (!canonical) {
      setRepoLoaded(false);
      setFetchError(null);
      return undefined;
    }

    if (previewDoneForRepoRef.current === canonical) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setFetchingRepo(true);
        setFetchError(null);
        try {
          const preview = await apiClient.previewRepo(url);
          if (cancelled) {
            return;
          }
          setName((prev) => (prev.trim() ? prev : preview.fullName));
          setDefaultBranch(preview.defaultBranch);
          setSelectedBranch("");
          setBranches(preview.branches);
          setRepoLoaded(true);
          previewDoneForRepoRef.current = canonical;
        } catch (error) {
          if (cancelled) {
            return;
          }
          setRepoLoaded(false);
          setFetchError(formatPreviewError(error));
        } finally {
          if (!cancelled) {
            setFetchingRepo(false);
          }
        }
      })();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [repoUrl]);

  return (
    <form
      className="stack repo-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmedUrl = repoUrl.trim();
        let ready = repoLoaded;

        if (!ready && isGitHubRepoUrl(trimmedUrl)) {
          setLoading(true);
          setFetchError(null);
          try {
            const preview = await apiClient.previewRepo(trimmedUrl);
            setName((prev) => (prev.trim() ? prev : preview.fullName));
            setDefaultBranch(preview.defaultBranch);
            setBranches(preview.branches);
            setRepoLoaded(true);
            const c = canonicalRepoUrl(trimmedUrl);
            if (c) {
              previewDoneForRepoRef.current = c;
            }
            ready = true;
          } catch (error) {
            setFetchError(formatPreviewError(error));
            setLoading(false);
            return;
          }
          setLoading(false);
        }

        if (!ready) {
          setFetchError("Enter a valid GitHub repository URL and wait for preview to finish.");
          return;
        }

        setLoading(true);
        await onSubmit({
          name: name.trim() || "Untitled project",
          repoUrl: trimmedUrl,
          branch: selectedBranch || undefined,
          description: description || undefined,
        });
        setRepoUrl("");
        setName("");
        setSelectedBranch("");
        setDefaultBranch("");
        setBranches([]);
        setRepoLoaded(false);
        setFetchError(null);
        setDescription("");
        previewDoneForRepoRef.current = "";
        setLoading(false);
      }}
    >
      <label className="field repo-url-field">
        GitHub Repo URL
        <div className="repo-url-row">
          <input
            value={repoUrl}
            onChange={(event) => {
              const next = event.target.value;
              const prevCanon = canonicalRepoUrl(repoUrl);
              const nextCanon = canonicalRepoUrl(next);
              setRepoUrl(next);
              if (prevCanon !== nextCanon) {
                setRepoLoaded(false);
                previewDoneForRepoRef.current = "";
              }
              setFetchError(null);
            }}
            placeholder="https://github.com/owner/repo"
            required
          />
          {fetchingRepo ? (
            <span className="muted repo-url-status" aria-live="polite">
              Loading preview…
            </span>
          ) : repoLoaded && isGitHubRepoUrl(repoUrl) ? (
            <span className="repo-url-status repo-url-status-ok" aria-live="polite">
              Ready
            </span>
          ) : null}
        </div>
      </label>
      {fetchError ? <p className="error-text">{fetchError}</p> : null}
      {repoLoaded ? (
        <p className="muted repo-helper">
          Default branch: <strong>{defaultBranch}</strong> (used if no branch selected)
        </p>
      ) : (
        <p className="muted repo-helper">
          Paste a GitHub URL — preview loads after you stop typing. For fewer rate limits, add a GitHub token in Settings.
        </p>
      )}

      <label className="field">
        Project Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="owner/repo"
          required
        />
      </label>
      <label className="field">
        Branch
        <select
          value={selectedBranch}
          onChange={(event) => setSelectedBranch(event.target.value)}
          disabled={!repoLoaded}
        >
          <option value="">
            {defaultBranch
              ? `Use default (${defaultBranch})`
              : "Use repository default"}
          </option>
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Description (optional)
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <button type="submit" disabled={loading || fetchingRepo}>
        {loading ? "Creating..." : fetchingRepo ? "Loading preview…" : "Create Project"}
      </button>
    </form>
  );
}
