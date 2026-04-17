import { useEffect, useState } from "react";

const STEPS = [
  "Understanding your question",
  "Searching the repository for relevant context",
  "Analyzing code, issues, and history",
  "Grounding an answer in what we found",
];

type Props = {
  active: boolean;
};

/**
 * ChatGPT-style collapsible “thinking” row while the assistant request is in flight.
 */
export function ThinkingCollapsible({ active }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (active) {
      setExpanded(true);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setSeconds(0);
      return;
    }
    const t0 = Date.now();
    const tick = window.setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - t0) / 1000)));
    }, 500);
    const rotate = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 2600);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(rotate);
    };
  }, [active]);

  if (!active) {
    return null;
  }

  const timeLabel = seconds < 1 ? "a moment" : seconds === 1 ? "1 second" : `${seconds} seconds`;

  return (
    <details
      className="cgpt-thinking"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      aria-busy="true"
    >
      <summary className="cgpt-thinking-summary">
        <span className="cgpt-thinking-chevron" aria-hidden>
          ›
        </span>
        <span className="cgpt-thinking-title">Thought for {timeLabel}</span>
      </summary>
      <div className="cgpt-thinking-body">
        <p className="cgpt-thinking-step">{STEPS[stepIndex]}</p>
        <p className="cgpt-thinking-hint">Retrieval and models run on the server; this view updates when the reply is ready.</p>
      </div>
    </details>
  );
}
