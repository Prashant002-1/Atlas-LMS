"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CopyIcon, TerminalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AnsiStyle = {
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  foreground?: keyof typeof ANSI_FOREGROUNDS;
  background?: keyof typeof ANSI_BACKGROUNDS;
};

export type AnsiSegment = AnsiStyle & { text: string };

const ANSI_FOREGROUNDS = {
  black: "#8b949e",
  red: "#ff7b72",
  green: "#7ee787",
  yellow: "#e3b341",
  blue: "#79c0ff",
  magenta: "#d2a8ff",
  cyan: "#a5d6ff",
  white: "#f0f6fc",
  brightBlack: "#8b949e",
  brightRed: "#ffa198",
  brightGreen: "#aff5b4",
  brightYellow: "#f2cc60",
  brightBlue: "#a5d6ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#b6e3ff",
  brightWhite: "#ffffff",
} as const;

const ANSI_BACKGROUNDS = {
  black: "#161b22",
  red: "#5a1e1e",
  green: "#1b4721",
  yellow: "#4d3b12",
  blue: "#17355c",
  magenta: "#3b2459",
  cyan: "#164450",
  white: "#6e7681",
  brightBlack: "#30363d",
  brightRed: "#7d2727",
  brightGreen: "#275d2e",
  brightYellow: "#684f18",
  brightBlue: "#204a78",
  brightMagenta: "#513276",
  brightCyan: "#1d5b69",
  brightWhite: "#8b949e",
} as const;

const COLOR_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/** Parse the safe, visual subset of ANSI SGR used by terminals and test tools. */
export function parseAnsi(input: string): AnsiSegment[] {
  const output: AnsiSegment[] = [];
  const style: AnsiStyle = {};
  const pattern = /\u001b\[([0-9;]*)m/g;
  let cursor = 0;

  const push = (text: string) => {
    if (text) output.push({ ...style, text });
  };

  for (const match of input.matchAll(pattern)) {
    const index = match.index ?? cursor;
    push(input.slice(cursor, index));
    const codes = (match[1] || "0").split(";").map((code) => Number(code || 0));
    for (const code of codes) applyAnsiCode(style, code);
    cursor = index + match[0].length;
  }
  push(input.slice(cursor));
  return output;
}

function applyAnsiCode(style: AnsiStyle, code: number) {
  if (code === 0) {
    delete style.bold;
    delete style.dim;
    delete style.underline;
    delete style.foreground;
    delete style.background;
  } else if (code === 1) style.bold = true;
  else if (code === 2) style.dim = true;
  else if (code === 4) style.underline = true;
  else if (code === 22) {
    delete style.bold;
    delete style.dim;
  } else if (code === 24) delete style.underline;
  else if (code === 39) delete style.foreground;
  else if (code === 49) delete style.background;
  else if (code >= 30 && code <= 37) style.foreground = COLOR_NAMES[code - 30];
  else if (code >= 90 && code <= 97) style.foreground = `bright${capitalize(COLOR_NAMES[code - 90])}` as keyof typeof ANSI_FOREGROUNDS;
  else if (code >= 40 && code <= 47) style.background = COLOR_NAMES[code - 40];
  else if (code >= 100 && code <= 107) style.background = `bright${capitalize(COLOR_NAMES[code - 100])}` as keyof typeof ANSI_BACKGROUNDS;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export type TerminalProps = {
  command?: string;
  stdout?: string;
  stderr?: string;
  output?: string;
  title?: string;
  isStreaming?: boolean;
  exitCode?: number | null;
  className?: string;
};

export function Terminal({
  command,
  stdout,
  stderr,
  output,
  title = "Terminal",
  isStreaming = false,
  exitCode,
  className,
}: TerminalProps) {
  const terminalOutput = stdout ?? output ?? "";
  const copyValue = [command ? `$ ${command}` : "", terminalOutput, stderr ?? ""].filter(Boolean).join("\n");
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStreaming && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [isStreaming, terminalOutput, stderr]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const copy = useCallback(async () => {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(copyValue);
    setCopied(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1800);
  }, [copyValue]);

  return (
    <section
      aria-label={title}
      className={cn("w-full max-w-[42rem] overflow-hidden rounded-panel border border-[#30363d] bg-[#0d1117] text-[#e6edf3]", className)}
    >
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-[#30363d] px-3">
        <div className="flex min-w-0 items-center gap-2 text-[0.71875rem] text-[#8b949e]">
          <TerminalIcon size={14} aria-hidden />
          <span className="truncate font-medium text-[#c9d1d9]">{title}</span>
          {isStreaming ? <span className="atlas-terminal-pulse">Running</span> : null}
          {!isStreaming && typeof exitCode === "number" ? (
            <span className={exitCode === 0 ? "text-[#7ee787]" : "text-[#ff7b72]"}>Exit {exitCode}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Terminal output copied" : "Copy terminal output"}
          title={copied ? "Copied" : "Copy output"}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-[#8b949e] transition hover:bg-[#21262d] hover:text-[#f0f6fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent-strong)]"
        >
          {copied ? <CheckIcon size={13} aria-hidden /> : <CopyIcon size={13} aria-hidden />}
        </button>
      </header>
      <div ref={bodyRef} className="max-h-96 overflow-auto p-3.5">
        <pre data-atlas-terminal className="m-0 min-w-max whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-[1.65]">
          {command ? <span className="block text-[#8b949e]"><span className="select-none text-[#7ee787]">$ </span>{command}</span> : null}
          <AnsiText value={terminalOutput} />
          {stderr ? <span className="text-[#ff7b72]"><AnsiText value={stderr} /></span> : null}
          {isStreaming ? <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[0.42rem] animate-pulse bg-[#f0f6fc] align-[-0.12em]" /> : null}
        </pre>
      </div>
    </section>
  );
}

function AnsiText({ value }: { value: string }) {
  const segments = useMemo(() => parseAnsi(value), [value]);
  return segments.map((segment, index) => (
    <span
      key={`${index}-${segment.text.length}`}
      style={{
        color: segment.foreground ? ANSI_FOREGROUNDS[segment.foreground] : undefined,
        backgroundColor: segment.background ? ANSI_BACKGROUNDS[segment.background] : undefined,
        fontWeight: segment.bold ? 650 : undefined,
        opacity: segment.dim ? 0.68 : undefined,
        textDecoration: segment.underline ? "underline" : undefined,
      }}
    >
      {segment.text}
    </span>
  ));
}
