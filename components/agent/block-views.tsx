import type { ReactNode } from "react";
import type {
  AnnouncementBlock,
  AnswerBlock,
  AssignmentBlock,
  Block,
  ExplanationBlock,
  ModuleBlock,
  ObjectiveBlock,
  PageBlock,
  PracticeSetBlock,
  RubricBlock,
} from "@/lib/agent/blocks";
import { Markdown } from "@/components/agent/markdown";

/**
 * The component registry, every block type the agent can emit has exactly one
 * renderer. Server pages (Review) and the streaming client both render through
 * this map, so a drafted block looks identical in flight and at rest.
 */

function BlockFrame({
  kind,
  title,
  meta,
  children,
}: {
  kind: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="atlas-mono shrink-0 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">{kind}</span>
          <h4 className="truncate text-[14px] font-semibold text-[var(--color-ink)]">{title}</h4>
        </div>
        {meta ? <div className="shrink-0 text-[12px] text-[var(--color-muted)]">{meta}</div> : null}
      </header>
      <div className="px-4 py-3">{children}</div>
    </article>
  );
}

function CodeChips({ codes }: { codes?: string[] }) {
  if (!codes?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {codes.map((code) => (
        <span
          key={code}
          className="atlas-mono rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted)]"
        >
          {code}
        </span>
      ))}
    </span>
  );
}

function Prose({ text }: { text: string }) {
  return <Markdown>{text}</Markdown>;
}

export function ObjectiveBlockView({ block }: { block: ObjectiveBlock }) {
  return (
    <BlockFrame
      kind="Objective"
      title={block.code}
      meta={
        <span className="atlas-mono">
          {block.bloomLevel} · {Math.round(block.assessmentWeight * 100)}%
        </span>
      }
    >
      <Prose text={block.description} />
    </BlockFrame>
  );
}

export function ModuleBlockView({ block }: { block: ModuleBlock }) {
  return (
    <BlockFrame
      kind="Module"
      title={block.name}
      meta={block.week ? <span className="atlas-mono">week {block.week}</span> : undefined}
    >
      <Prose text={block.summaryMd} />
      <div className="mt-3">
        <CodeChips codes={block.objectiveCodes} />
      </div>
    </BlockFrame>
  );
}

export function AssignmentBlockView({ block }: { block: AssignmentBlock }) {
  return (
    <BlockFrame
      kind="Work"
      title={block.name}
      meta={
        <span className="atlas-mono">
          {block.pointsPossible}pts{block.dueWeek ? ` · week ${block.dueWeek}` : ""}
        </span>
      }
    >
      <Prose text={block.descriptionMd} />
      <div className="mt-3">
        <CodeChips codes={block.objectiveCodes} />
      </div>
    </BlockFrame>
  );
}

export function PageBlockView({ block }: { block: PageBlock }) {
  return (
    <BlockFrame kind="Page" title={block.title}>
      <Prose text={block.bodyMd} />
      {block.objectiveCodes?.length ? (
        <div className="mt-3">
          <CodeChips codes={block.objectiveCodes} />
        </div>
      ) : null}
    </BlockFrame>
  );
}

export function AnnouncementBlockView({ block }: { block: AnnouncementBlock }) {
  return (
    <BlockFrame kind="Note" title={block.title}>
      <Prose text={block.messageMd} />
    </BlockFrame>
  );
}

export function PracticeSetBlockView({ block, reveal = true }: { block: PracticeSetBlock; reveal?: boolean }) {
  return (
    <BlockFrame kind="Practice" title={block.title} meta={<span className="atlas-mono">{block.questions.length} questions</span>}>
      <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
        <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Base</p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--color-ink)]">{block.base}</p>
      </div>
      <ol className="mt-3 space-y-3">
        {block.questions.map((q, i) => (
          <li key={i} className="border-t border-[var(--color-border)] pt-3 first:border-t-0 first:pt-0">
            <p className="text-[14px] leading-6 text-[var(--color-ink)]">
              <span className="atlas-mono mr-2 text-[12px] text-[var(--color-faint)]">{i + 1}.</span>
              {q.prompt}
            </p>
            {q.options?.length ? (
              <ul className="mt-2 space-y-1 pl-6">
                {q.options.map((opt, j) => (
                  <li key={j} className="text-[13px] leading-5 text-[var(--color-muted)]">
                    <span className="atlas-mono mr-1.5 text-[11px]">{String.fromCharCode(97 + j)})</span>
                    {opt}
                  </li>
                ))}
              </ul>
            ) : null}
            {reveal ? (
              <details className="mt-2 pl-6">
                <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-accent-strong)]">Answer</summary>
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-ink)]">{q.answer}</p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{q.rationaleMd}</p>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="mt-3">
        <CodeChips codes={block.objectiveCodes} />
      </div>
    </BlockFrame>
  );
}

export function RubricBlockView({ block }: { block: RubricBlock }) {
  return (
    <BlockFrame kind="Rubric" title={block.title}>
      <div className="space-y-3">
        {block.criteria.map((criterion, i) => (
          <div key={i} className="border-t border-[var(--color-border)] pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-medium text-[var(--color-ink)]">{criterion.name}</p>
              <span className="atlas-mono text-[12px] text-[var(--color-muted)]">{Math.round(criterion.weight * 100)}%</span>
            </div>
            <div className="mt-2 grid gap-1.5">
              {criterion.levels.map((level, j) => (
                <p key={j} className="text-[13px] leading-5 text-[var(--color-muted)]">
                  <span className="atlas-mono mr-2 text-[11px] uppercase tracking-[0.06em] text-[var(--color-faint)]">{level.label}</span>
                  {level.description}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}

function Citations({ citations }: { citations: Array<{ label: string; sourceType: string }> }) {
  if (!citations.length) return null;
  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-2">
      <p className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">From the course record</p>
      <ul className="mt-1 space-y-0.5">
        {citations.map((c, i) => (
          <li key={i} className="text-[12px] leading-5 text-[var(--color-muted)]">
            {c.label} <span className="atlas-mono text-[11px] text-[var(--color-faint)]">({c.sourceType})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExplanationBlockView({ block }: { block: ExplanationBlock }) {
  return (
    <div>
      <p className="atlas-serif text-[16px] font-medium leading-6 text-[var(--color-ink)]">{block.headline}</p>
      <div className="mt-2">
        <Markdown>{block.bodyMd}</Markdown>
      </div>
      {block.checkQuestion ? (
        <p className="mt-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-[13px] leading-5 text-[var(--color-ink)]">
          <span className="atlas-mono mr-2 text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">Check yourself</span>
          {block.checkQuestion}
        </p>
      ) : null}
      <Citations citations={block.citations} />
    </div>
  );
}

export function AnswerBlockView({ block }: { block: AnswerBlock }) {
  return (
    <div>
      <Markdown>{block.bodyMd}</Markdown>
      {block.escalate ? (
        <p className="mt-3 rounded-[6px] border border-[color-mix(in_oklch,var(--color-warn)_38%,transparent)] bg-[color-mix(in_oklch,var(--color-warn)_12%,transparent)] px-3 py-2 text-[13px] leading-5 text-[var(--color-warn)]">
          This one belongs with your professor, the course record does not answer it.
        </p>
      ) : null}
      <Citations citations={block.citations} />
    </div>
  );
}

/** Render any block through the registry. Unknown blocks degrade to visible JSON, never a crash. */
export function BlockView({ block, reveal }: { block: Block; reveal?: boolean }) {
  switch (block.type) {
    case "objective":
      return <ObjectiveBlockView block={block} />;
    case "module":
      return <ModuleBlockView block={block} />;
    case "assignment":
      return <AssignmentBlockView block={block} />;
    case "page":
      return <PageBlockView block={block} />;
    case "announcement":
      return <AnnouncementBlockView block={block} />;
    case "practice_set":
      return <PracticeSetBlockView block={block} reveal={reveal} />;
    case "rubric":
      return <RubricBlockView block={block} />;
    case "explanation":
      return <ExplanationBlockView block={block} />;
    case "answer":
      return <AnswerBlockView block={block} />;
    default:
      return (
        <pre className="overflow-x-auto rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-[12px] text-[var(--color-muted)]">
          {JSON.stringify(block, null, 2)}
        </pre>
      );
  }
}
