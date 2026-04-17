/**
 * Cleans assistant markdown for chat display: removes redundant Answer:/Evidence:
 * labels when the UI already shows structured sources as chips.
 */
export function stripAssistantAnswerForDisplay(raw: string, hasSourceChips: boolean): string {
  let t = raw.trim();
  if (!t) {
    return t;
  }

  // Leading "Answer" label (optional markdown heading / bold)
  const answerLine = /^(?:#{1,6}\s*)?(?:\*\*)?\s*Answer\s*(?:\*\*)?\s*:?\s*\n*/i;
  for (let i = 0; i < 6; i++) {
    const next = t.replace(answerLine, "").trimStart();
    if (next === t) {
      break;
    }
    t = next;
  }

  // Standalone "Answer:" lines left in the body (model sometimes repeats)
  t = t.replace(/\n(?:#{1,6}\s*)?(?:\*\*)?\s*Answer\s*(?:\*\*)?\s*:?\s*(?=\n|$)/gi, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");

  if (hasSourceChips) {
    // Evidence list is redundant with source chips — strip trailing Evidence block
    t = t.replace(/\n(?:#{1,6}\s*)?(?:\*\*)?\s*Evidence\s*(?:\*\*)?\s*:?\s*[\s\S]*$/i, "");
    t = t.replace(/^(?:#{1,6}\s*)?(?:\*\*)?\s*Evidence\s*(?:\*\*)?\s*:?\s*[\s\S]*$/i, "");
  } else {
    // Collapse repeated Evidence headers into one block opener
    t = t.replace(
      /\n(?:#{1,6}\s*)?(?:\*\*)?\s*Evidence\s*(?:\*\*)?\s*:?\s*\n+(?:#{1,6}\s*)?(?:\*\*)?\s*Evidence\s*(?:\*\*)?\s*:?\s*/gi,
      "\nEvidence:\n",
    );
  }

  return t.trim();
}
