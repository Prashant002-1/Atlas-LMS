"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { Streamdown, type Components, type DiagramPlugin, type UrlTransform } from "streamdown";
import { cn } from "@/lib/utils";

/**
 * One streaming Markdown renderer for every Atlas surface.
 *
 * Streamdown owns incomplete-markdown repair, GFM tables, Shiki code, KaTeX,
 * and opt-in Mermaid previews. Atlas still owns the trust boundary: embedded
 * HTML is skipped, Markdown images never make automatic requests, and links
 * are limited to internal paths or HTTPS destinations. Explicit AI SDK file
 * parts are rendered by the message-part renderer instead.
 */

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

const urlTransform: UrlTransform = (url) => safeHref(url);

const COMPONENTS = {
  a(props) {
    const href = safeHref(typeof props.href === "string" ? props.href : undefined);
    if (!href) return <span>{props.children}</span>;
    const external = href.startsWith("https://");
    return (
      <a
        href={href}
        title={typeof props.title === "string" ? props.title : undefined}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {props.children}
      </a>
    );
  },
  img(props) {
    return props.alt ? <span className="text-[var(--color-muted)]">{props.alt}</span> : null;
  },
} satisfies Components;

/** Keep Mermaid and its parser out of the initial chat bundle. */
const lazyMermaid: DiagramPlugin = {
  language: "mermaid",
  name: "mermaid",
  type: "diagram",
  getMermaid(initialConfig) {
    let config = initialConfig;
    return {
      initialize(nextConfig) {
        config = { ...config, ...nextConfig };
      },
      async render(id, source) {
        const { createMermaidPlugin } = await import("@streamdown/mermaid");
        return createMermaidPlugin({ config: { ...config, theme: "default" } }).getMermaid().render(id, source);
      },
    };
  },
};

const plugins = { cjk, code, math, mermaid: lazyMermaid };

export function Markdown({
  children,
  streaming = false,
  className,
}: {
  children: string;
  streaming?: boolean;
  className?: string;
}) {
  return (
    <Streamdown
      className={cn("atlas-prose", className)}
      components={COMPONENTS}
      controls={{
        code: { copy: true, download: false },
        mermaid: { copy: true, download: true, fullscreen: true, panZoom: true },
        table: { copy: true, download: true, fullscreen: true },
      }}
      isAnimating={streaming}
      lineNumbers
      linkSafety={{ enabled: false }}
      mermaid={{ config: { securityLevel: "strict" } }}
      mode={streaming ? "streaming" : "static"}
      plugins={plugins}
      skipHtml
      urlTransform={urlTransform}
    >
      {children ?? ""}
    </Streamdown>
  );
}
