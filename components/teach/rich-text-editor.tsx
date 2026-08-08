"use client";

import { useRef, useState, type ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Code2, Heading2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/agent/markdown";

/**
 * A formatted text box for the places a professor writes to people.
 *
 * An announcement or a piece of feedback is prose with structure: a heading, a
 * list of what to fix, a quoted line from the student's own work. A bare
 * textarea makes the writer either type Markdown from memory or give up and
 * write a wall, and neither is what a teacher should be deciding about.
 *
 * The stored value stays Markdown. That is deliberate: every reader in this
 * product already renders Markdown, the agent drafts Markdown, and the same
 * text has to survive into an email digest and a student page without carrying
 * a nest of HTML. So the toolbar wraps a selection rather than switching to a
 * contenteditable rich-text model, which also means the raw text is always
 * exactly what will be saved. Preview shows the reader's view before sending.
 */

type Wrap = { before: string; after: string };
type LinePrefix = { prefix: string; ordered?: boolean };

export function RichTextEditor({
  name,
  label,
  labelHidden = false,
  defaultValue = "",
  rows = 10,
  autoFocus = false,
  minLength,
  maxLength,
  countMode = "always",
  placeholder,
  required = false,
  hint,
  onValueChange,
}: {
  name: string;
  label: string;
  labelHidden?: boolean;
  defaultValue?: string;
  rows?: number;
  autoFocus?: boolean;
  minLength?: number;
  maxLength?: number;
  countMode?: "always" | "near-limit" | "hidden";
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
  /** For callers that mirror the text elsewhere, such as a live preview. */
  onValueChange?: (value: string) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValueState] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const showCount = Boolean(
    maxLength &&
      countMode !== "hidden" &&
      (countMode === "always" || value.length >= Math.floor(maxLength * 0.8))
  );

  /* One writer for the text, so the mirror can never fall out of step. */
  const setValue = (next: string) => {
    setValueState(next);
    onValueChange?.(next);
  };

  /** Wrap the selection, or drop the markers and put the caret between them. */
  function applyWrap({ before, after }: Wrap) {
    const area = areaRef.current;
    if (!area) return;
    const { selectionStart, selectionEnd } = area;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;
    setValue(next);
    /* Keep the selection inside the markers so typing continues formatted. */
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
    });
  }

  /** Prefix every line the selection touches, which is how lists actually work. */
  function applyLines({ prefix, ordered = false }: LinePrefix) {
    const area = areaRef.current;
    if (!area) return;
    const { selectionStart, selectionEnd } = area;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineEnd = value.indexOf("\n", selectionEnd) === -1 ? value.length : value.indexOf("\n", selectionEnd);
    const block = value.slice(lineStart, lineEnd) || "";
    const lines = block.split("\n");
    const marked = lines
      .map((line, index) => {
        const mark = ordered ? `${index + 1}. ` : prefix;
        return line.startsWith(mark) ? line.slice(mark.length) : `${mark}${line}`;
      })
      .join("\n");
    const next = `${value.slice(0, lineStart)}${marked}${value.slice(lineEnd)}`;
    setValue(next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(lineStart, lineStart + marked.length);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className={cn("flex flex-wrap items-baseline gap-2", labelHidden ? "justify-end" : "justify-between")}>
        <label
          htmlFor={`${name}-editor`}
          className={cn("text-[0.75rem] font-medium text-[var(--color-ink)]", labelHidden && "sr-only")}
        >
          {label}
        </label>
        <button
          type="button"
          onClick={() => setPreview((open) => !open)}
          aria-pressed={preview}
          className="text-[0.71875rem] font-medium text-[var(--color-muted)] underline decoration-[color-mix(in_oklch,currentColor_40%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-ink)]"
        >
          {preview ? "Keep writing" : "Preview"}
        </button>
      </div>

      <div className="overflow-hidden rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] focus-within:border-[var(--color-accent-strong)] focus-within:bg-[var(--color-surface)]">
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          aria-controls={`${name}-editor`}
          className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] px-1.5 py-1.5"
        >
          <ToolButton label="Heading" onClick={() => applyLines({ prefix: "## " })} disabled={preview}>
            <Heading2 size={14} aria-hidden />
          </ToolButton>
          <ToolButton label="Bold" onClick={() => applyWrap({ before: "**", after: "**" })} disabled={preview}>
            <Bold size={14} aria-hidden />
          </ToolButton>
          <ToolButton label="Italic" onClick={() => applyWrap({ before: "_", after: "_" })} disabled={preview}>
            <Italic size={14} aria-hidden />
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-[var(--color-border)]" aria-hidden />
          <ToolButton label="Bulleted list" onClick={() => applyLines({ prefix: "- " })} disabled={preview}>
            <List size={14} aria-hidden />
          </ToolButton>
          <ToolButton label="Numbered list" onClick={() => applyLines({ prefix: "1. ", ordered: true })} disabled={preview}>
            <ListOrdered size={14} aria-hidden />
          </ToolButton>
          <ToolButton label="Quote" onClick={() => applyLines({ prefix: "> " })} disabled={preview}>
            <Quote size={14} aria-hidden />
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-[var(--color-border)]" aria-hidden />
          <ToolButton label="Link" onClick={() => applyWrap({ before: "[", after: "](https://)" })} disabled={preview}>
            <Link2 size={14} aria-hidden />
          </ToolButton>
          <ToolButton label="Code" onClick={() => applyWrap({ before: "`", after: "`" })} disabled={preview}>
            <Code2 size={14} aria-hidden />
          </ToolButton>
        </div>

        {preview ? (
          <div className="min-h-[8rem] px-3.5 py-3">
            {value.trim() ? (
              <Markdown className="text-[0.875rem] leading-7">{value}</Markdown>
            ) : (
              <p className="text-[0.8125rem] text-[var(--color-muted)]">Nothing to preview yet.</p>
            )}
          </div>
        ) : null}

        {/*
          The textarea is always mounted, even under preview, so the form posts
          the same field either way and a submit while previewing cannot lose
          what was written.
        */}
        <textarea
          ref={areaRef}
          id={`${name}-editor`}
          name={name}
          rows={rows}
          autoFocus={autoFocus}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          className={cn(
            "w-full resize-y border-0 bg-transparent px-3.5 py-3 text-[0.8125rem] leading-6 text-[var(--color-ink)] outline-none",
            preview && "hidden"
          )}
        />
      </div>

      {hint || showCount ? (
        <div className={`flex flex-wrap items-baseline gap-2 ${hint ? "justify-between" : "justify-end"}`}>
          {hint ? <span className="text-[0.6875rem] text-[var(--color-faint)]">{hint}</span> : null}
          {showCount && maxLength ? (
            <span className="text-[0.6875rem] tabular-nums text-[var(--color-faint)]">
              {value.length} / {maxLength}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-7 items-center justify-center rounded-control text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)]"
    >
      {children}
    </button>
  );
}
