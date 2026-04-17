import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MessageModel } from "../types/app";
import { MessageBubble } from "./MessageBubble";
import { ThinkingCollapsible } from "./ThinkingCollapsible";

type Props = {
  messages: MessageModel[];
  onSend: (content: string) => Promise<void>;
  errorText?: string | null;
  pendingUserContent?: string | null;
  awaitingAssistant?: boolean;
  /** First fetch of messages (e.g. full page refresh on /chat/...). */
  messagesInitialLoading?: boolean;
  messagesError?: string | null;
};

export function ChatWindow({
  messages,
  onSend,
  errorText,
  pendingUserContent,
  awaitingAssistant = false,
  messagesInitialLoading = false,
  messagesError = null,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submitComposer = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || awaitingAssistant) {
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
  }, [text, sending, awaitingAssistant, onSend]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const main = shell?.closest("main.content") as HTMLElement | null;
    if (!main) {
      return;
    }

    if (messagesInitialLoading || messagesError) {
      main.scrollTop = 0;
      return;
    }

    const shouldPinToLatest =
      messages.length > 0 || Boolean(pendingUserContent) || awaitingAssistant;
    if (!shouldPinToLatest) {
      main.scrollTop = 0;
      return;
    }

    const anchor = bottomAnchorRef.current;
    if (!anchor) {
      return;
    }

    /*
     * Never use `main.scrollTop = main.scrollHeight`: with sticky composer + flex layout,
     * `scrollHeight` can include a large empty band so the viewport lands on “nothing”.
     * Pin using the thread bottom anchor instead.
     */
    const pin = () => {
      anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    pin();
    const t = window.setTimeout(pin, 120);
    return () => window.clearTimeout(t);
  }, [
    messages,
    pendingUserContent,
    awaitingAssistant,
    sending,
    messagesInitialLoading,
    messagesError,
  ]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
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
          {!messagesInitialLoading && !messagesError && messages.length === 0 && !pendingUserContent && !awaitingAssistant ? (
            <p className="cgpt-thread-empty muted">Ask anything about this repository. Answers use indexed files, issues, PRs, and history.</p>
          ) : null}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {pendingUserContent ? (
            <div className="cgpt-turn cgpt-turn-user">
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
            disabled={!text.trim() || sending || awaitingAssistant}
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
