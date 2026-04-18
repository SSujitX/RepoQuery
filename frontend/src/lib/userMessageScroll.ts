/**
 * Split a user message so we can scroll to the last sub-question when one bubble
 * contains several questions (multiple paragraphs with "?", or multiple "?" on one line).
 */
export function splitUserMessageForScroll(content: string): { before: string; focus: string } | null {
  const t = content.trim();
  if (!t) {
    return null;
  }

  const paras = t.split(/\n\n+/);
  const paraIndicesWithQ = paras.map((p, i) => (p.includes("?") ? i : -1)).filter((i) => i >= 0);
  if (paraIndicesWithQ.length > 1) {
    const fi = paraIndicesWithQ[paraIndicesWithQ.length - 1];
    const focus = paras[fi];
    const before = paras.slice(0, fi).join("\n\n");
    return { before, focus };
  }

  const qPositions = [...t.matchAll(/\?/g)]
    .map((m) => m.index)
    .filter((i): i is number => i !== undefined);
  if (qPositions.length > 1) {
    const lastQ = qPositions[qPositions.length - 1];
    const prevQ = qPositions[qPositions.length - 2];
    let start = prevQ + 1;
    while (start < t.length && /\s/.test(t[start])) {
      start++;
    }
    const focus = t.slice(start, lastQ + 1).trim();
    if (focus.length > 0) {
      return { before: t.slice(0, start), focus };
    }
  }

  return null;
}
