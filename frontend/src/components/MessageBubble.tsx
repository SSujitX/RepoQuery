import { useMemo, useCallback, useState } from "react";
import type { MessageModel } from "../types/app";
import { stripAssistantAnswerForDisplay } from "../lib/assistantMessageFormat";
import { parseChatMarkdown } from "../lib/markdownChat";
import { evidenceLinesFromAssistantContent, evidenceToChips } from "../lib/evidenceChips";
import { splitUserMessageForScroll } from "../lib/userMessageScroll";

type Props = {
  message: MessageModel;
  /** Latest user message in the thread — used to scroll/focus after a reply completes. */
  lastUserTurn?: boolean;
  /** Chat title — used for download filename. */
  chatTitle?: string | null;
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
      />
    </svg>
  );
}

function downloadFilenameForAnswer(chatTitle: string | null | undefined, messageId: string): string {
  const raw = (chatTitle ?? "").trim();
  const base = raw
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const name = base || "chat";
  return `${name}-${messageId.slice(0, 8)}.md`;
}

export function MessageBubble({ message, lastUserTurn = false, chatTitle = null }: Props) {
  const [copied, setCopied] = useState(false);
  const chips = useMemo(() => {
    const fromJson = evidenceToChips(message.evidenceJson ?? undefined);
    if (fromJson.length > 0) {
      return fromJson;
    }
    return evidenceLinesFromAssistantContent(message.content);
  }, [message.evidenceJson, message.content]);
  const assistantDisplayContent = useMemo(() => {
    const cleaned = stripAssistantAnswerForDisplay(message.content, chips.length > 0);
    return cleaned.length > 0 ? cleaned : message.content.trim();
  }, [message.content, chips.length]);

  const userHtml = useMemo(() => parseChatMarkdown(message.content), [message.content]);
  const scrollParts = useMemo(
    () => (lastUserTurn ? splitUserMessageForScroll(message.content) : null),
    [lastUserTurn, message.content],
  );
  const userBeforeHtml = useMemo(
    () => (scrollParts && scrollParts.before.trim() ? parseChatMarkdown(scrollParts.before) : ""),
    [scrollParts],
  );
  const userFocusHtml = useMemo(
    () => (scrollParts ? parseChatMarkdown(scrollParts.focus) : ""),
    [scrollParts],
  );
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

  const downloadAssistant = useCallback(() => {
    const blob = new Blob([assistantDisplayContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilenameForAnswer(chatTitle, message.id);
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }, [assistantDisplayContent, chatTitle, message.id]);

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
      <div className="cgpt-turn cgpt-turn-user" id={lastUserTurn ? "cgpt-last-user-turn" : undefined}>
        <div className="cgpt-bubble cgpt-bubble-user">
          <div className="cgpt-answer-surface cgpt-answer-surface-user" onClick={handleMarkdownClick}>
            {scrollParts ? (
              <>
                {scrollParts.before.trim().length > 0 ? (
                  <div className="markdown cgpt-markdown" dangerouslySetInnerHTML={{ __html: userBeforeHtml }} />
                ) : null}
                <span className="cgpt-user-scroll-focus">
                  <div className="markdown cgpt-markdown" dangerouslySetInnerHTML={{ __html: userFocusHtml }} />
                </span>
              </>
            ) : (
              <div className="markdown cgpt-markdown" dangerouslySetInnerHTML={{ __html: userHtml }} />
            )}
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
      <div className="cgpt-msg-actions" role="toolbar" aria-label="Answer actions">
        <button
          type="button"
          className="cgpt-msg-action cgpt-msg-action--copy"
          onClick={() => void copyAssistant()}
          title="Copy"
          aria-label="Copy answer"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className="cgpt-msg-action cgpt-msg-action--download"
          onClick={downloadAssistant}
          title="Download"
          aria-label="Download answer as Markdown"
        >
          <DownloadIcon />
        </button>
        {copied ? <span className="cgpt-msg-actions-hint">Copied</span> : null}
      </div>
      {chips.length ? (
        <section
          id={`cgpt-msg-sources-${message.id}`}
          className="cgpt-sources-panel"
          aria-label="Sources used in this answer"
        >
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
    </div>
  );
}
