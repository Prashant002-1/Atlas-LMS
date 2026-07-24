import Link from "next/link";
import type { ReactNode } from "react";
import { Markdown } from "@/components/agent/markdown";
import { ActionButton, TextLink } from "@/components/atlas/primitives";
import { RubricCard } from "@/components/planning/rubric-card";
import { reviewCourseProposal } from "@/lib/instructor/actions";
import type { Block } from "@/lib/agent/blocks";
import type { InstructorProposal } from "@/lib/instructor/workspace";

export function ProposalQueue({
  proposals,
  selectedId,
}: {
  proposals: InstructorProposal[];
  selectedId?: string;
}) {
  return (
    <section aria-labelledby="draft-queue-heading">
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <h2 id="draft-queue-heading" className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Drafts</h2>
        <span className="text-[0.71875rem] tabular-nums text-[var(--color-faint)]">{proposals.length}</span>
      </div>
      {proposals.length > 0 ? (
        <nav aria-label="Draft queue" className="border-b border-[var(--color-border)]">
          {proposals.map((proposal) => {
            const selected = proposal.id === selectedId;
            return (
              <Link
                key={proposal.id}
                href={`/teach/review?proposal=${proposal.id}`}
                aria-current={selected ? "page" : undefined}
                className={`block border-t border-[var(--color-border)] px-3 py-3.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] ${
                  selected ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                <span className="block text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{proposal.title}</span>
                <span className="mt-1 flex items-center justify-between gap-3 text-[0.6875rem] text-[var(--color-faint)]">
                  <span>{proposalType(proposal)}</span>
                  <time dateTime={proposal.createdAt?.toISOString()}>{shortStamp(proposal.createdAt)}</time>
                </span>
              </Link>
            );
          })}
        </nav>
      ) : (
        <p className="border-y border-[var(--color-border)] px-3 py-5 text-[0.8125rem] text-[var(--color-muted)]">No open drafts.</p>
      )}
    </section>
  );
}

export function ProposalPreview({ proposal }: { proposal: InstructorProposal }) {
  const open = proposal.status === "pending";
  const returnTo = `/teach/review?proposal=${proposal.id}`;

  return (
    <article aria-labelledby="proposal-preview-heading" className="min-w-0">
      <header className="border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium text-[var(--color-faint)]">{open ? "Open draft" : decisionLabel(proposal.status)}</p>
            <h2 id="proposal-preview-heading" className="atlas-serif mt-1.5 text-[1.375rem] font-semibold leading-7 text-[var(--color-ink)]">{proposal.title}</h2>
          </div>
          <time dateTime={proposal.createdAt?.toISOString()} className="text-[0.71875rem] tabular-nums text-[var(--color-faint)]">
            {fullStamp(proposal.createdAt)}
          </time>
        </div>
        {proposal.summary && proposal.summary !== proposal.title ? (
          <p className="mt-3 max-w-3xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">{proposal.summary}</p>
        ) : null}
        {proposal.thread ? (
          <p className="mt-3 text-[0.75rem] text-[var(--color-muted)]">
            From <TextLink href={`/teach/atlas?thread=${proposal.thread.id}`} className="text-[0.75rem]">{proposal.thread.title ?? "Atlas thread"}</TextLink>
          </p>
        ) : null}
      </header>

      <div className="divide-y divide-[var(--color-border)]">
        {proposal.blocks.length > 0 ? (
          proposal.blocks.map((block, index) => <ProposalBlockPreview key={`${block.type}-${index}`} block={block} />)
        ) : (
          <p className="py-8 text-[0.8125rem] text-[var(--color-muted)]">This draft has no readable records.</p>
        )}
      </div>

      {proposal.appliedRecords.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] py-4 text-[0.75rem]">
          <span className="text-[var(--color-faint)]">Applied records</span>
          {proposal.appliedRecords.map((record) => <TextLink key={record.href} href={record.href} className="text-[0.75rem]">{record.label}</TextLink>)}
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-5">
          <form action={reviewCourseProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <input type="hidden" name="decision" value="approved" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <ActionButton>Apply</ActionButton>
          </form>
          <form action={reviewCourseProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <input type="hidden" name="decision" value="rejected" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <ActionButton variant="danger">Dismiss</ActionButton>
          </form>
        </div>
      ) : proposal.decidedAt ? (
        <p className="border-t border-[var(--color-border)] pt-4 text-[0.75rem] text-[var(--color-muted)]">
          {decisionLabel(proposal.status)} {fullStamp(proposal.decidedAt)}
        </p>
      ) : null}
    </article>
  );
}

export function ProposalHistory({
  proposals,
  selectedId,
}: {
  proposals: InstructorProposal[];
  selectedId?: string;
}) {
  if (proposals.length === 0) return null;

  return (
    <section aria-labelledby="decision-history-heading" className="mt-10">
      <h2 id="decision-history-heading" className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Decision history</h2>
      <div className="mt-3 overflow-x-auto border-b border-[var(--color-border)]">
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[0.6875rem] text-[var(--color-faint)]">
              <th scope="col" className="px-3 py-2.5 font-medium">Draft</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Decision</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Created</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Decided</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
            {proposals.map((proposal) => (
              <tr key={proposal.id} className={proposal.id === selectedId ? "bg-[var(--color-surface-muted)]" : undefined}>
                <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                  <Link href={`/teach/review?proposal=${proposal.id}`} className="underline decoration-[color-mix(in_oklch,var(--color-ink)_28%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
                    {proposal.title}
                  </Link>
                </th>
                <td className="px-3 py-3.5 text-[var(--color-muted)]">{decisionLabel(proposal.status)}</td>
                <td className="px-3 py-3.5 tabular-nums text-[var(--color-muted)]">{shortStamp(proposal.createdAt)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-muted)]">{shortStamp(proposal.decidedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProposalBlockPreview({ block }: { block: Block }) {
  if (block.type === "announcement") {
    return <RecordSection label="Announcement" title={block.title}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.messageMd}</Markdown></RecordSection>;
  }
  if (block.type === "page") {
    return <RecordSection label="Page" title={block.title}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.bodyMd}</Markdown></RecordSection>;
  }
  if (block.type === "module") {
    return <RecordSection label={block.week ? `Week ${block.week}` : "Module"} title={block.name}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.summaryMd}</Markdown></RecordSection>;
  }
  if (block.type === "assignment") {
    return (
      <RecordSection label="Assignment" title={block.name} meta={`${block.pointsPossible} points${block.dueWeek ? ` / due week ${block.dueWeek}` : ""}`}>
        <Markdown className="mt-4 text-[0.84375rem] leading-7">{block.descriptionMd}</Markdown>
      </RecordSection>
    );
  }
  if (block.type === "objective") {
    return (
      <RecordSection label="Learning objective" title={`${block.code}: ${block.description}`}>
        <dl className="mt-4 grid gap-4 text-[0.78125rem] sm:grid-cols-2">
          <Fact label="Level" value={titleCase(block.bloomLevel)} />
          <Fact label="Assessment weight" value={`${Math.round(block.assessmentWeight * 100)}%`} />
        </dl>
      </RecordSection>
    );
  }
  if (block.type === "practice_set") {
    return (
      <RecordSection label="Practice set" title={block.title} meta={`${block.questions.length} questions`}>
        <p className="mt-4 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{block.base}</p>
        <ol className="mt-5 divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
          {block.questions.map((question, index) => (
            <li key={index} className="py-4">
              <p className="text-[0.8125rem] font-medium leading-6 text-[var(--color-ink)]">{index + 1}. {question.prompt}</p>
              {question.options?.length ? <p className="mt-2 text-[0.75rem] leading-5 text-[var(--color-muted)]">{question.options.join(" / ")}</p> : null}
              <p className="mt-2 text-[0.75rem] leading-5 text-[var(--color-muted)]"><span className="font-medium text-[var(--color-ink)]">Answer:</span> {question.answer}</p>
              <Markdown className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">{question.rationaleMd}</Markdown>
            </li>
          ))}
        </ol>
      </RecordSection>
    );
  }
  if (block.type === "ai_assignment") {
    return (
      <RecordSection label="AI assignment" title={block.title}>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Fact label="Session" value={`${block.durationMinutes} minutes`} />
          <Fact label="Personal record notes" value={block.personalRecordSideNotes ? "On" : "Off"} />
        </dl>
        <p className="mt-5 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{block.instructions}</p>
        <RubricCard title="Rubric" criteria={block.criteria} className="mt-5" />
        <p className="mt-3 text-right"><TextLink href={`/teach/assignments/${block.assignmentId}`} className="text-[0.75rem]">Open assignment</TextLink></p>
      </RecordSection>
    );
  }
  if (block.type === "session_rubric") {
    return (
      <RecordSection label="Rubric revision" title={block.title}>
        <RubricCard criteria={block.criteria} className="mt-5" />
        <p className="mt-3 flex flex-wrap items-baseline justify-between gap-3 text-[0.75rem] text-[var(--color-muted)]">
          <span>Existing grades remain on their original rubric version.</span>
          <TextLink href={`/teach/ai-assignments/${block.assignmentId}`} className="text-[0.75rem]">Open AI assignment</TextLink>
        </p>
      </RecordSection>
    );
  }
  if (block.type === "rubric") {
    return (
      <RecordSection label="Rubric" title={block.title}>
        <div className="mt-4 divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
          {block.criteria.map((criterion) => (
            <section key={criterion.name} className="py-4">
              <div className="flex items-baseline justify-between gap-4">
                <h4 className="text-[0.8125rem] font-medium text-[var(--color-ink)]">{criterion.name}</h4>
                <span className="text-[0.71875rem] tabular-nums text-[var(--color-muted)]">{Math.round(criterion.weight * 100)}%</span>
              </div>
              <dl className="mt-2 space-y-1">
                {criterion.levels.map((level) => <Fact key={level.label} label={level.label} value={level.description} row />)}
              </dl>
            </section>
          ))}
        </div>
      </RecordSection>
    );
  }
  if (block.type === "explanation") {
    return <RecordSection label="Explanation" title={block.headline}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.bodyMd}</Markdown></RecordSection>;
  }
  return <RecordSection label="Answer" title="Draft response"><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.bodyMd}</Markdown></RecordSection>;
}

function RecordSection({ label, title, meta, children }: { label: string; title: string; meta?: string; children?: ReactNode }) {
  return (
    <section className="py-6 first:pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-medium text-[var(--color-faint)]">{label}</p>
          <h3 className="mt-1 text-[1rem] font-semibold leading-6 text-[var(--color-ink)]">{title}</h3>
        </div>
        {meta ? <p className="text-[0.71875rem] tabular-nums text-[var(--color-muted)]">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, row = false }: { label: string; value: string; row?: boolean }) {
  if (row) {
    return <div className="grid gap-1 py-1 text-[0.75rem] sm:grid-cols-[8rem_minmax(0,1fr)]"><dt className="text-[var(--color-faint)]">{label}</dt><dd className="leading-5 text-[var(--color-muted)]">{value}</dd></div>;
  }
  return <div><dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt><dd className="mt-1 text-[0.78125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd></div>;
}

function proposalType(proposal: InstructorProposal): string {
  if (proposal.blocks.length === 0) return titleCase(proposal.kind.replaceAll("_", " "));
  const types = [...new Set(proposal.blocks.map((block) => titleCase(block.type.replaceAll("_", " "))))];
  return types.join(" / ");
}

function decisionLabel(status: InstructorProposal["status"]): string {
  if (status === "rejected") return "Dismissed";
  if (status === "applied") return "Applied";
  if (status === "approved") return "Approved";
  return "Open";
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortStamp(value?: Date | null): string {
  return value ? value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
}

function fullStamp(value?: Date | null): string {
  return value
    ? value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
}
