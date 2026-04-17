import { useMemo, useCallback, useState } from "react";
import type { MessageModel } from "../types/app";
import { stripAssistantAnswerForDisplay } from "../lib/assistantMessageFormat";
import { parseChatMarkdown } from "../lib/markdownChat";
import { evidenceToChips } from "../lib/evidenceChips";

type Props = {
  message: MessageModel;
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

export function MessageBubble({ message }: Props) {
  const [copied, setCopied] = useState(false);
  const chips = useMemo(() => evidenceToChips(message.evidenceJson ?? undefined), [message.evidenceJson]);
  const assistantDisplayContent = useMemo(() => {
    const cleaned = stripAssistantAnswerForDisplay(message.content, chips.length > 0);
    return cleaned.length > 0 ? cleaned : message.content.trim();
  }, [message.content, chips.length]);

  const userHtml = useMemo(() => parseChatMarkdown(message.content), [message.content]);
  const assistantHtml = useMemo(() => parseChatMarkdown(assistantDisplayContent), [assistantDisplayContent]);

  const copyAssistant = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(assistantDisplayContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [assistantDisplayContent]);

  const handleMarkdownClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('.cgpt-code-copy-btn');
    if (!btn) return;
    const frame = btn.closest('.cgpt-code-frame');
    const codeEl = frame?.querySelector('code');
    if (!codeEl) return;
    try {
      await navigator.clipboard.writeText(codeEl.textContent || '');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span style="color:#86efac; font-size:12px;">Copied!</span>';
      setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
    } catch {}
  }, []);

  if (message.role === "user") {
    return (
      <div className="cgpt-turn cgpt-turn-user">
        <div className="cgpt-bubble cgpt-bubble-user">
          <div className="cgpt-answer-surface cgpt-answer-surface-user" onClick={handleMarkdownClick}>
            <div className="markdown cgpt-markdown" dangerouslySetInnerHTML={{ __html: userHtml }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cgpt-turn cgpt-turn-assistant">
      <div className="cgpt-bubble cgpt-bubble-assistant">
        <div className="cgpt-answer-surface" onClick={handleMarkdownClick}>
          <div className="markdown cgpt-markdown" dangerouslySetInnerHTML={{ __html: assistantHtml }} />
        </div>
      </div>
      {chips.length ? (
        <section className="cgpt-sources-panel" aria-label="Sources used in this answer">
          <h3 className="cgpt-sources-heading">Sources</h3>
          <div className="cgpt-source-chips">
            {chips.map((c, i) => (
              <span key={i} className="cgpt-source-chip" title={c.title ?? c.label}>
                {c.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      <div className="cgpt-msg-actions">
        <button type="button" className="cgpt-icon-btn" onClick={() => void copyAssistant()} title="Copy answer">
          <CopyIcon />
        </button>
        {copied ? <span className="cgpt-msg-actions-hint">Copied</span> : null}
      </div>
    </div>
  );
}
