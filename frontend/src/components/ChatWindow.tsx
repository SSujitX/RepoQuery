import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MessageModel } from "../types/app";
import { MessageBubble } from "./MessageBubble";
import { ThinkingCollapsible } from "./ThinkingCollapsible";

type Props = {
  messages: MessageModel[];
  onSend: (content: string) => Promise<void>;
  errorText?: string | null;
  pendingUserContent?: string | null;
  /** Thinking / retrieval strip under the thread. */
  awaitingAssistant?: boolean;
  /** Lock composer while the send request is in flight (can differ when refetch already shows the reply). */
  sendBlocked?: boolean;
  /** First fetch of messages (e.g. full page refresh on /chat/...). */
  messagesInitialLoading?: boolean;
  messagesError?: string | null;
  /** Chat id — resets scroll bookkeeping when switching threads. */
  threadKey?: string;
  /** Chat title for assistant download filenames. */
  chatTitle?: string | null;
};

export function ChatWindow({
  messages,
  onSend,
  errorText,
  pendingUserContent,
  awaitingAssistant = false,
  sendBlocked,
  messagesInitialLoading = false,
  messagesError = null,
  threadKey = "",
  chatTitle = null,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const composerBlocked = sendBlocked ?? awaitingAssistant;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasPinnedInitialRef = useRef(false);
  const prevSendBlockedRef = useRef(false);

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  useLayoutEffect(() => {
    hasPinnedInitialRef.current = false;
    prevSendBlockedRef.current = false;
  }, [threadKey]);

  const submitComposer = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || composerBlocked) {
      return;
    }
    setSending(true);
    setText("");
    try {
      await onSend(trimmed);
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }, [text, sending, composerBlocked, onSend]);

  useLayoutEffect(() => {
    const main = shellRef.current?.closest("main.content") as HTMLElement | null;
    if (!main) {
      return;
    }

    if (messagesInitialLoading || messagesError) {
      main.scrollTop = 0;
      return;
    }

    const blocked = Boolean(sendBlocked);
    const justFinishedSend = prevSendBlockedRef.current && !blocked;
    prevSendBlockedRef.current = blocked;

    const inFlight =
      Boolean(pendingUserContent) || blocked || Boolean(awaitingAssistant);

    const pinBottom = () => {
      const anchor = bottomAnchorRef.current;
      if (!anchor) {
        return;
      }
      anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    /** ChatGPT-style: while waiting for the reply, keep the user’s message at the top of the scroll
     * area so the middle is free for Thinking + the assistant answer; composer stays at the bottom. */
    const pinUserTurnToTop = () => {
      const inflight =
        document.getElementById("cgpt-inflight-user-turn") ??
        document.getElementById("cgpt-last-user-turn");
      inflight?.scrollIntoView({ block: "start", inline: "nearest" });
    };

    if (justFinishedSend && messages.length > 0) {
      requestAnimationFrame(() => {
        const root = document.getElementById("cgpt-last-user-turn");
        const focus = root?.querySelector<HTMLElement>(".cgpt-user-scroll-focus");
        (focus ?? root)?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      hasPinnedInitialRef.current = true;
      return;
    }

    if (inFlight) {
      pinUserTurnToTop();
      const t = window.setTimeout(pinUserTurnToTop, 120);
      return () => window.clearTimeout(t);
    }

    if (messages.length === 0 && !pendingUserContent) {
      main.scrollTop = 0;
      return;
    }

    if (messages.length > 0 && !hasPinnedInitialRef.current) {
      pinBottom();
      hasPinnedInitialRef.current = true;
      return;
    }
  }, [messages, pendingUserContent, sendBlocked, awaitingAssistant, messagesInitialLoading, messagesError]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    if (!text.trim()) {
      el.style.height = "48px";
      return;
    }
    el.style.height = "0";
    el.style.height = `${Math.min(200, Math.max(48, el.scrollHeight))}px`;
  }, [text]);

  return (
    <div className="cgpt-chat-shell" ref={shellRef}>
      <div className="cgpt-thread-scroll">
        <div className="cgpt-thread-inner">
          {messagesInitialLoading ? (
            <p className="cgpt-thread-empty muted">Loading conversation…</p>
          ) : null}
          {messagesError ? <p className="error-text cgpt-thread-empty">{messagesError}</p> : null}
          {!messagesInitialLoading && !messagesError && messages.length === 0 && !pendingUserContent && !composerBlocked ? (
            <p className="cgpt-thread-empty muted">Ask anything about this repository. Answers use indexed files, issues, PRs, and history.</p>
          ) : null}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              chatTitle={chatTitle}
              lastUserTurn={
                Boolean(!pendingUserContent) &&
                message.role === "user" &&
                message.id === lastUserMessageId
              }
            />
          ))}
          {pendingUserContent ? (
            <div className="cgpt-turn cgpt-turn-user" id="cgpt-inflight-user-turn">
              <div className="cgpt-bubble cgpt-bubble-user cgpt-bubble-pending">
                <p className="cgpt-plain-text">{pendingUserContent}</p>
              </div>
            </div>
          ) : null}
          <ThinkingCollapsible active={awaitingAssistant} />
          <div ref={bottomAnchorRef} className="cgpt-thread-bottom-anchor" aria-hidden />
        </div>
      </div>

      <div className="cgpt-composer-wrap">
        <form
          className="cgpt-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitComposer();
          }}
        >
          <textarea
            ref={textareaRef}
            className="cgpt-composer-input"
            rows={1}
            placeholder="Ask anything"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitComposer();
              }
            }}
          />
          <button
            type="submit"
            className="cgpt-composer-send icon-btn primary-btn"
            disabled={!text.trim() || sending || composerBlocked}
            aria-label="Send message"
            title="Send"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M5 12a1 1 0 0 1 1-1h8.59l-2.3-2.29a1 1 0 1 1 1.42-1.42l4 4a1 1 0 0 1 0 1.42l-4 4a1 1 0 0 1-1.42-1.42L14.59 13H6a1 1 0 0 1-1-1Z"
              />
            </svg>
          </button>
        </form>
        <p className="cgpt-composer-disclaimer">RepoQuery can make mistakes. Verify important changes against the real repository.</p>
        {errorText ? <p className="error-text cgpt-composer-error">{errorText}</p> : null}
      </div>
    </div>
  );
}
