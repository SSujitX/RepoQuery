export type EvidenceChip = {
  label: string;
  title?: string;
};

function asObjectRecords(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x));
}

function pushUnique(out: EvidenceChip[], seen: Set<string>, label: string, title?: string, max = 14) {
  if (out.length >= max) {
    return;
  }
  const key = `${label}\0${title ?? ""}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  out.push({ label, title });
}

/**
 * Flattens stored retrieval evidence into small “source” chips for the chat UI.
 */
export function evidenceToChips(evidence: Record<string, unknown> | null | undefined): EvidenceChip[] {
  if (!evidence || typeof evidence !== "object") {
    return [];
  }
  const out: EvidenceChip[] = [];
  const seen = new Set<string>();

  for (const f of asObjectRecords(evidence.fileMatches)) {
    const path = typeof f.path === "string" ? f.path : "";
    if (path) {
      const short = path.includes("/") ? path.split("/").pop() ?? path : path;
      pushUnique(out, seen, short, path);
    }
  }

  for (const c of asObjectRecords(evidence.textChunks)) {
    const path = typeof c.path === "string" ? c.path : "";
    if (path) {
      const short = path.includes("/") ? path.split("/").pop() ?? path : path;
      pushUnique(out, seen, short, path);
    }
  }

  for (const s of asObjectRecords(evidence.symbolMatches)) {
    const sym = typeof s.symbolName === "string" ? s.symbolName : "";
    const file = s.file && typeof s.file === "object" && !Array.isArray(s.file) ? (s.file as Record<string, unknown>) : null;
    const path = file && typeof file.path === "string" ? file.path : "";
    if (sym) {
      pushUnique(out, seen, sym, path || undefined);
    }
  }

  for (const issue of asObjectRecords(evidence.issues)) {
    const n = typeof issue.githubIssueNumber === "number" ? issue.githubIssueNumber : Number(issue.githubIssueNumber);
    const title = typeof issue.title === "string" ? issue.title : "";
    if (Number.isFinite(n) && title) {
      pushUnique(out, seen, `Issue #${n}`, title);
    }
  }

  for (const pr of asObjectRecords(evidence.prs)) {
    const n = typeof pr.githubPrNumber === "number" ? pr.githubPrNumber : Number(pr.githubPrNumber);
    const title = typeof pr.title === "string" ? pr.title : "";
    if (Number.isFinite(n) && title) {
      pushUnique(out, seen, `PR #${n}`, title);
    }
  }

  for (const d of asObjectRecords(evidence.discussions)) {
    const n =
      typeof d.githubDiscussionNumber === "number" ? d.githubDiscussionNumber : Number(d.githubDiscussionNumber);
    const title = typeof d.title === "string" ? d.title : "";
    if (Number.isFinite(n) && title) {
      pushUnique(out, seen, `Discussion #${n}`, title);
    }
  }

  for (const c of asObjectRecords(evidence.commits)) {
    const sha = typeof c.commitSha === "string" ? c.commitSha : "";
    const msg = typeof c.message === "string" ? c.message : "";
    if (sha.length >= 7 && msg) {
      pushUnique(out, seen, sha.slice(0, 7), msg.split("\n")[0]);
    }
  }

  return out;
}
