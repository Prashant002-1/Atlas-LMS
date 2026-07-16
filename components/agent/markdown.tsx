import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * One Markdown renderer for agent output and stored draft prose. Embedded HTML
 * stays disabled, images never make automatic external requests, and links are
 * limited to internal paths or HTTPS destinations that require a user click.
 */

function closeOpenMarkdown(input: string): string {
  let text = input;
  if ((text.match(/```/g)?.length ?? 0) % 2 === 1) return `${text}\n\`\`\``;
  text = text.replace(/!?\[[^\]]*\]\([^)]*$/u, "");
  text = text.replace(/!?\[[^\]]*$/u, "");
  if ((text.match(/`/g)?.length ?? 0) % 2 === 1) text += "`";
  if ((text.match(/\*\*/g)?.length ?? 0) % 2 === 1) text += "**";
  if ((text.match(/(?<!\*)\*(?!\*)/g)?.length ?? 0) % 2 === 1) text += "*";
  return text;
}

function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const parsed = new URL(href);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const COMPONENTS: Components = {
  a(props) {
    const href = safeHref(props.href);
    if (!href) return <span>{props.children}</span>;
    const external = href.startsWith("https://");
    return (
      <a
        href={href}
        title={props.title}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {props.children}
      </a>
    );
  },
  img(props) {
    return props.alt ? <span>{props.alt}</span> : null;
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS} skipHtml>
        {streaming ? closeOpenMarkdown(source) : source}
      </ReactMarkdown>
    </div>
  );
}
