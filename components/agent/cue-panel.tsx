"use client";

import { useRef, useState } from "react";
import { CircleStop, Lightbulb, MessageCircleQuestion, PenLine } from "lucide-react";
import { runAgentStream, toolParts, textOf } from "@/lib/agent/stream-client";
import { blockSchema, type Block } from "@/lib/agent/blocks";
import { BlockView } from "@/components/agent/block-views";
import { Markdown } from "@/components/agent/markdown";

/**
 * Student cues, buttons, not chat. Each cue is anchored to the record on the
 * page and runs once, shaped by the professor's policy. The response is a typed
 * block (explanation, practice set, answer), grounded in the course record.
 */

export type CueTarget = {
  courseId: string;
  targetType: "assignment" | "module" | "page" | "course";
  targetId: string | null;
};

type CueAvailability = {
  allowExplain: boolean;
  allowPractice: boolean;
  allowQuestions: boolean;
  personaName?: string | null;
};

type CueState =
  | { phase: "idle" }
  | { phase: "running"; kind: string }
  | { phase: "done"; kind: string; block: Block | null; text: string }
  | { phase: "error"; message: string };

const CUE_TOOL_TYPES: Record<string, string> = {
  emitExplanation: "explanation",
  emitPractice: "practice_set",
  emitAnswer: "answer",
};

function parseCueBlock(toolName: string, payload: unknown): Block | null {
  const type = CUE_TOOL_TYPES[toolName];
  if (!type || !payload || typeof payload !== "object") return null;
  const parsed = blockSchema.safeParse({ ...(payload as object), type });
  return parsed.success ? parsed.data : null;
}

export function CuePanel({ target, availability }: { target: CueTarget; availability: CueAvailability }) {
  const [state, setState] = useState<CueState>({ phase: "idle" });
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const anyCue = availability.allowExplain || availability.allowPractice || availability.allowQuestions;
  if (!anyCue) return null;

  async function run(kind: "explain" | "practice" | "question", q?: string) {
    if (state.phase === "running") return;
    setState({ phase: "running", kind });
    try {
      const handle = await runAgentStream("/api/agent/cue", {
        courseId: target.courseId,
        kind,
        targetType: target.targetType,
        targetId: target.targetId,
        question: q,
      });
      abortRef.current = handle.abort;

      let block: Block | null = null;
      let text = "";
      for await (const message of handle.messages) {
        text = textOf(message);
        const part = toolParts(message).find((p) => CUE_TOOL_TYPES[p.toolName]);
        if (part) {
          block = parseCueBlock(part.toolName, part.input) ?? parseCueBlock(part.toolName, part.output) ?? block;
        }
        setState({ phase: "done", kind, block, text });
      }
      setState({ phase: "done", kind, block, text });
      setAsking(false);
      setQuestion("");
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : "That didn't work." });
    } finally {
      abortRef.current = null;
    }
  }

  const cueButton =
    "inline-flex min-h-9 items-center gap-1.5 rounded-[7px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";

  return (
    <div className="border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
          {availability.personaName ? availability.personaName : "Atlas"}
        </span>
        {availability.allowExplain ? (
          <button type="button" className={cueButton} disabled={state.phase === "running"} onClick={() => void run("explain")}>
            <Lightbulb size={14} strokeWidth={2} aria-hidden /> Explain
          </button>
        ) : null}
        {availability.allowPractice ? (
          <button type="button" className={cueButton} disabled={state.phase === "running"} onClick={() => void run("practice")}>
            <PenLine size={14} strokeWidth={2} aria-hidden /> Practice
          </button>
        ) : null}
        {availability.allowQuestions ? (
          <button
            type="button"
            className={cueButton}
            disabled={state.phase === "running"}
            onClick={() => setAsking((v) => !v)}
            aria-expanded={asking}
          >
            <MessageCircleQuestion size={14} strokeWidth={2} aria-hidden /> Ask
          </button>
        ) : null}
        {state.phase === "running" ? (
          <button
            type="button"
            onClick={() => abortRef.current?.()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[7px] px-2 text-[13px] text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          >
            <CircleStop size={14} strokeWidth={2} aria-hidden /> Stop
          </button>
        ) : null}
      </div>

      {asking ? (
        <form
          className="mt-3 flex items-stretch gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (question.trim().length >= 4) void run("question", question);
          }}
        >
          <label htmlFor="cue-question" className="sr-only">
            Ask one course question
          </label>
          <input
            id="cue-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="One quick question about this"
            autoComplete="off"
            maxLength={1200}
            className="min-h-10 w-full rounded-[7px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
          />
          <button
            type="submit"
            disabled={question.trim().length < 4 || state.phase === "running"}
            className="inline-flex min-h-10 items-center rounded-[7px] border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 text-[13px] font-medium text-white transition hover:bg-[var(--color-accent-strong)] hover:border-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      ) : null}

      <div aria-live="polite">
        {state.phase === "running" ? (
          <p className="atlas-mono mt-3 flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" aria-hidden />
            Reading the course record
          </p>
        ) : null}
        {state.phase === "error" ? (
          <p className="mt-3 rounded-[6px] border border-[rgba(140,60,40,0.25)] bg-[rgba(140,60,40,0.06)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
            {state.message}
          </p>
        ) : null}
        {state.phase === "done" ? (
          <div className="mt-4 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-panel)]">
            {state.block ? (
              <BlockView block={state.block} />
            ) : state.text ? (
              <Markdown>{state.text}</Markdown>
            ) : (
              <p className="text-[13px] text-[var(--color-muted)]">Nothing came back. Try again.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
