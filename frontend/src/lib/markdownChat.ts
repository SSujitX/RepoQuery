import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import hljs from "highlight.js/lib/core";
import { marked } from "marked";
import "highlight.js/styles/tokyo-night-dark.min.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("py", python);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("zsh", bash);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("kt", kotlin);
hljs.registerLanguage("kts", kotlin);
hljs.registerLanguage("rb", ruby);

const AUTO_LANG_SUBSET = [
  "javascript",
  "typescript",
  "python",
  "rust",
  "go",
  "bash",
  "json",
  "yaml",
  "xml",
  "css",
  "sql",
  "markdown",
  "csharp",
  "cpp",
  "ruby",
  "php",
  "kotlin",
  "swift",
  "diff",
  "dockerfile",
] as const;

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rs: "rust",
  yml: "yaml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  kts: "kotlin",
  kt: "kotlin",
  rb: "ruby",
  cs: "csharp",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  h: "cpp",
  hpp: "cpp",
  md: "markdown",
  jsonc: "json",
  golang: "go",
};

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeLang(lang: string | undefined): string | null {
  if (!lang) {
    return null;
  }
  const raw = lang.trim().toLowerCase();
  return LANG_ALIASES[raw] ?? raw;
}

function highlightBlock(text: string, langRaw: string | undefined): { value: string; label: string } {
  const normalized = normalizeLang(langRaw);
  try {
    if (normalized && hljs.getLanguage(normalized)) {
      return {
        value: hljs.highlight(text, { language: normalized }).value,
        label: (langRaw ?? normalized).trim().slice(0, 22),
      };
    }
    const auto = hljs.highlightAuto(text, [...AUTO_LANG_SUBSET]);
    return {
      value: auto.value,
      label: (langRaw?.trim() || auto.language || "code").slice(0, 22),
    };
  } catch {
    return { value: escapeHtml(text), label: "code" };
  }
}

let markedConfigured = false;

function ensureMarkedChat() {
  if (markedConfigured) {
    return;
  }
  markedConfigured = true;
  marked.use({
    breaks: true,
    renderer: {
      code({ text, lang }) {
        const { value, label } = highlightBlock(text, lang);
        const labelHtml = escapeHtml(label);
        return `<div class="cgpt-code-frame"><div class="cgpt-code-lang"><span>${labelHtml}</span><button type="button" class="cgpt-code-copy-btn" aria-label="Copy code" title="Copy"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy</button></div><pre class="cgpt-code-pre"><code class="hljs">${value}</code></pre></div>`;
      },
    },
  });
}

/** Markdown → HTML for chat bubbles (syntax-highlighted fenced code). */
export function parseChatMarkdown(raw: string): string {
  ensureMarkedChat();
  try {
    return marked.parse(raw) as string;
  } catch {
    return `<p class="cgpt-md-fallback">${escapeHtml(raw)}</p>`;
  }
}
