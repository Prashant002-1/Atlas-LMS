import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * One Markdown renderer for everything the agent writes: the streaming command
 * narration, every block body (`descriptionMd`, `bodyMd`, `summaryMd`, ...),
 * and the at-rest Review surface. The model speaks Markdown; without a parser
 * its `#`, `**`, and `-` leak into the UI as raw characters. This typesets that
 * Markdown in the Observatory palette via the `.atlas-prose` scope in
 * globals.css.
 *
 * Safety: react-markdown does not render embedded HTML (we deliberately omit
 * rehype-raw), so model output can't inject markup. Links open in a new tab.
 *
 * Streaming: while a run is in flight the text arrives a token at a time, so a
 * half-typed `**bold` or an open ``` fence would otherwise flash its
 * delimiters. When `streaming` is set we close those dangling tokens for the
 * current frame, the standard approach for rendering Markdown mid-stream.
 *
 * Server-safe (no "use client"): renders in the Review server tree and inside
 * the client console alike.
 */

function closeOpenMarkdown(input: string): string {
  let text = input;

  // An open fenced code block swallows everything after it; close it, and
  // stop, since tokens inside a fence are literal anyway.
  if ((text.match(/```/g)?.length ?? 0) % 2 === 1) {
    return `${text}\n\`\`\``;
  }

  // A link/image whose target hasn't closed yet: "[label](http..."; hide the
  // fragment rather than render a broken link.
  text = text.replace(/!?\[[^\]]*\]\([^)]*$/u, "");
  // A label with no closing bracket yet: "[lab" or "![al".
  text = text.replace(/!?\[[^\]]*$/u, "");

  // Dangling inline code, then bold, then italic.
  if ((text.match(/`/g)?.length ?? 0) % 2 === 1) text += "`";
  if ((text.match(/\*\*/g)?.length ?? 0) % 2 === 1) text += "**";
  if ((text.match(/(?<!\*)\*(?!\*)/g)?.length ?? 0) % 2 === 1) text += "*";

  return text;
}

const COMPONENTS: Components = {
  // Only forward known-safe attributes; never spread react-markdown's `node`
  // onto the DOM. Links open in a new tab.
  a(props) {
    return (
      <a href={props.href} title={props.title} target="_blank" rel="noopener noreferrer">
        {props.children}
      </a>
    );
  },
};

export function Markdown({
  children,
  streaming = false,
  className,
}: {
  children: string;
  streaming?: boolean;
  className?: string;
}) {
  const source = children ?? "";
  return (
    <div className={`atlas-prose ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {streaming ? closeOpenMarkdown(source) : source}
      </ReactMarkdown>
    </div>
  );
}
