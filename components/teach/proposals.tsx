import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Markdown } from "@/components/agent/markdown";
import { ActionButton, TextLink } from "@/components/atlas/primitives";
import { RubricCard } from "@/components/planning/rubric-card";
import { reviewCourseProposal } from "@/lib/instructor/actions";
import type { Block } from "@/lib/agent/blocks";
import type { InstructorProposal } from "@/lib/instructor/workspace";

export function ProposalQueue({
  proposals,
}: {
  proposals: InstructorProposal[];
}) {
  return (
    <section aria-labelledby="draft-queue-heading">
      <div>
        <h2 id="draft-queue-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Drafts</h2>
        <p className="mt-1 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{proposals.length} open</p>
      </div>
      {proposals.length > 0 ? (
        <nav aria-label="Draft queue" className="mt-4 overflow-hidden border-b border-[var(--color-border)]">
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_11rem_1rem] gap-4 border-b border-[var(--color-border)] px-3 py-2.5 text-[0.71875rem] font-medium text-[var(--color-muted)] sm:grid">
            <span>Draft</span>
            <span>Record</span>
            <span>Created</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
          {proposals.map((proposal) => {
            return (
              <Link
                key={proposal.id}
                href={`/teach/review?proposal=${proposal.id}`}
                className="group/draft grid gap-2 px-3 py-3.5 transition hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent-strong)] sm:grid-cols-[minmax(0,1fr)_10rem_11rem_1rem] sm:items-center sm:gap-4"
              >
                <span className="min-w-0 text-[0.8125rem] font-semibold leading-5 text-[var(--color-ink)]">{proposal.title}</span>
                <span className="text-[0.75rem] text-[var(--color-muted)]">{proposal.recordLabel}</span>
                <time dateTime={proposal.createdAt?.toISOString()} className="text-[0.71875rem] tabular-nums text-[var(--color-muted)]">{shortStamp(proposal.createdAt)}</time>
                <ChevronRight size={15} aria-hidden className="hidden text-[var(--color-faint)] transition group-hover/draft:translate-x-0.5 group-hover/draft:text-[var(--color-ink)] sm:block" />
              </Link>
            );
          })}
          </div>
        </nav>
      ) : (
        <p className="py-4 text-[0.8125rem] text-[var(--color-muted)]">No open drafts.</p>
      )}
    </section>
  );
}

export function ProposalPreview({ proposal }: { proposal: InstructorProposal }) {
  const open = proposal.status === "pending";
  const returnTo = `/teach/review?proposal=${proposal.id}`;
  const reviewedAt = open ? proposal.createdAt : proposal.decidedAt ?? proposal.createdAt;
  const appliedRecords = proposal.appliedRecords.filter((record) => record.href !== proposal.destination?.href);

  return (
    <article aria-label={`${proposal.recordLabel} review`} className="min-w-0 max-w-5xl">
      <header className="-mt-4 border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-ink)]">{decisionLabel(proposal.status)}</span>
          <time dateTime={reviewedAt?.toISOString()} className="tabular-nums">{fullStamp(reviewedAt)}</time>
          {proposal.thread ? (
            <span>
              From <TextLink href={`/teach/atlas?thread=${proposal.thread.id}`} className="text-[0.75rem]">{proposal.thread.title ?? "Atlas chat"}</TextLink>
            </span>
          ) : null}
          {proposal.destination ? (
            <TextLink href={proposal.destination.href} className="text-[0.75rem]">Open {proposal.destination.label.toLowerCase()}</TextLink>
          ) : null}
        </div>
        {proposal.summary && !isRedundantSummary(proposal.summary, proposal.title) ? (
          <p className="mt-4 max-w-3xl text-[0.8125rem] leading-6 text-[var(--color-muted)]">{proposal.summary}</p>
        ) : null}
      </header>

      <div className="divide-y divide-[var(--color-border)]">
        {proposal.blocks.length > 0 ? (
          proposal.blocks.map((block, index) => (
            <ProposalBlockPreview
              key={`${block.type}-${index}`}
              block={block}
              hideHeading={index === 0 && blockTitle(block) === proposal.title}
            />
          ))
        ) : (
          <p className="py-8 text-[0.8125rem] text-[var(--color-muted)]">This draft has no readable records.</p>
        )}
      </div>

      {appliedRecords.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-border)] py-4 text-[0.75rem]">
          <span className="text-[var(--color-faint)]">Applied records</span>
          {appliedRecords.map((record) => <TextLink key={record.href} href={record.href} className="text-[0.75rem]">{record.label}</TextLink>)}
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
      ) : null}
    </article>
  );
}

export function ProposalHistory({
  proposals,
}: {
  proposals: InstructorProposal[];
}) {
  if (proposals.length === 0) return null;

  return (
    <section aria-labelledby="recent-reviews-heading" className="mt-8">
      <div>
        <h2 id="recent-reviews-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Recent reviews</h2>
        <p className="mt-1 text-[0.75rem] tabular-nums text-[var(--color-muted)]">{proposals.length} {proposals.length === 1 ? "review" : "reviews"}</p>
      </div>
      <div className="mt-4 overflow-x-auto border-b border-[var(--color-border)]">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[0.6875rem] text-[var(--color-faint)]">
              <th scope="col" className="px-3 py-2.5 font-medium">Draft</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Record</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Decision</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Decided</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-[0.78125rem]">
            {proposals.map((proposal) => (
              <tr key={proposal.id} className="transition hover:bg-[var(--color-surface-muted)]">
                <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                  <Link href={`/teach/review?proposal=${proposal.id}`} className="underline decoration-[color-mix(in_oklch,var(--color-ink)_28%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">
                    {proposal.title}
                  </Link>
                </th>
                <td className="px-3 py-3.5 text-[var(--color-muted)]">{proposal.recordLabel}</td>
                <td className="px-3 py-3.5 text-[var(--color-muted)]">{decisionLabel(proposal.status)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-muted)]">{shortStamp(proposal.decidedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProposalBlockPreview({ block, hideHeading }: { block: Block; hideHeading?: boolean }) {
  if (block.type === "announcement") {
    return <RecordSection label="Announcement" title={block.title} hideHeading={hideHeading}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.messageMd}</Markdown></RecordSection>;
  }
  if (block.type === "page") {
    return <RecordSection label="Page" title={block.title} hideHeading={hideHeading}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.bodyMd}</Markdown></RecordSection>;
  }
  if (block.type === "module") {
    return <RecordSection label={block.week ? `Week ${block.week}` : "Module"} title={block.name} hideHeading={hideHeading}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.summaryMd}</Markdown></RecordSection>;
  }
  if (block.type === "assignment") {
    return (
      <RecordSection label="Assignment" title={block.name} meta={`${block.pointsPossible} points${block.dueWeek ? ` / due week ${block.dueWeek}` : ""}`} hideHeading={hideHeading}>
        <Markdown className="mt-4 text-[0.84375rem] leading-7">{block.descriptionMd}</Markdown>
      </RecordSection>
    );
  }
  if (block.type === "objective") {
    return (
      <RecordSection label="Learning objective" title={`${block.code}: ${block.description}`} hideHeading={hideHeading}>
        <dl className="mt-4 grid gap-4 text-[0.78125rem] sm:grid-cols-2">
          <Fact label="Level" value={titleCase(block.bloomLevel)} />
          <Fact label="Assessment weight" value={`${Math.round(block.assessmentWeight * 100)}%`} />
        </dl>
      </RecordSection>
    );
  }
  if (block.type === "practice_set") {
    return (
      <RecordSection label="Practice set" title={block.title} meta={`${block.questions.length} questions`} hideHeading={hideHeading}>
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
      <RecordSection label="AI assignment" title={block.title} hideHeading={hideHeading}>
        <dl className="mt-4">
          <Fact label="Session" value={`${block.durationMinutes} minutes`} />
        </dl>
        <p className="mt-5 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{block.instructions}</p>
        <RubricCard title="Rubric" criteria={block.criteria} className="mt-5" />
      </RecordSection>
    );
  }
  if (block.type === "session_rubric") {
    return (
      <RecordSection label="Rubric revision" title={block.title} hideHeading={hideHeading}>
        <RubricCard criteria={block.criteria} className="mt-5" />
        <p className="mt-3 text-[0.75rem] text-[var(--color-muted)]">Existing grades remain on their original rubric version.</p>
      </RecordSection>
    );
  }
  if (block.type === "rubric") {
    return (
      <RecordSection label="Rubric" title={block.title} hideHeading={hideHeading}>
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
    return <RecordSection label="Explanation" title={block.headline} hideHeading={hideHeading}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.bodyMd}</Markdown></RecordSection>;
  }
  return <RecordSection label="Answer" title="Draft response" hideHeading={hideHeading}><Markdown className="mt-4 text-[0.84375rem] leading-7">{block.bodyMd}</Markdown></RecordSection>;
}

function RecordSection({
  label,
  title,
  meta,
  hideHeading = false,
  children,
}: {
  label: string;
  title: string;
  meta?: string;
  hideHeading?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="py-6 first:pt-5">
      {hideHeading ? (
        meta ? <p className="text-[0.71875rem] tabular-nums text-[var(--color-muted)]">{meta}</p> : null
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-medium text-[var(--color-faint)]">{label}</p>
            <h3 className="mt-1 text-[1rem] font-semibold leading-6 text-[var(--color-ink)]">{title}</h3>
          </div>
          {meta ? <p className="text-[0.71875rem] tabular-nums text-[var(--color-muted)]">{meta}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}

function blockTitle(block: Block): string {
  if (block.type === "module" || block.type === "assignment") return block.name;
  if (block.type === "objective") return `${block.code}: ${block.description}`;
  if (block.type === "explanation") return block.headline;
  if (block.type === "answer") return "Draft response";
  return block.title;
}

function isRedundantSummary(summary: string, title: string): boolean {
  const normalizedSummary = comparableRecordTitle(summary);
  const normalizedTitle = comparableRecordTitle(title);
  return normalizedSummary === normalizedTitle
    || normalizedSummary.includes(normalizedTitle)
    || normalizedTitle.includes(normalizedSummary);
}

function comparableRecordTitle(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/\b(ai assignment|practice set|rubric revision)\b/g, " ")
    .replace(/\b(run|as|an|a|the|about)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function Fact({ label, value, row = false }: { label: string; value: string; row?: boolean }) {
  if (row) {
    return <div className="grid gap-1 py-1 text-[0.75rem] sm:grid-cols-[8rem_minmax(0,1fr)]"><dt className="text-[var(--color-faint)]">{label}</dt><dd className="leading-5 text-[var(--color-muted)]">{value}</dd></div>;
  }
  return <div><dt className="text-[0.6875rem] text-[var(--color-faint)]">{label}</dt><dd className="mt-1 text-[0.78125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd></div>;
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
