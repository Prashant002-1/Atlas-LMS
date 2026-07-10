import { Check, X } from "lucide-react";
import { ActionButton, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { RubricCard } from "@/components/planning/rubric-card";
import { reviewCourseProposal } from "@/lib/instructor/actions";
import type { InstructorProposal } from "@/lib/instructor/workspace";

const tone = { pending: "good", approved: "good", rejected: "warn", applied: "accent" } as const;
const label = { pending: "Ready", approved: "Approved", rejected: "Dismissed", applied: "Applied" } as const;

export function ProposalCard({ proposal, compact = false }: { proposal: InstructorProposal; compact?: boolean }) {
  const open = proposal.status === "pending";

  return (
    <article className="atlas-card-hover rounded-panel border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold leading-5">{proposal.title}</p>
          <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{blockSummary(proposal)}</p>
        </div>
        <StatusBadge tone={tone[proposal.status]}>{label[proposal.status]}</StatusBadge>
      </div>

      {!compact && proposal.blocks.length > 0 ? (
        <div className="mt-4 space-y-3">
          <ul className="divide-y divide-[var(--color-border)] rounded-panel border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
            {proposal.blocks.map((block, index) =>
              block.type === "ai_assignment" ? (
                <li key={index} className="px-3 py-2.5">
                  <div className="mb-2.5">
                    <p className="text-[0.8125rem] leading-5 text-[var(--color-ink)]">{block.instructions}</p>
                    <p className="atlas-mono mt-1.5 text-[0.65625rem] uppercase tracking-[0.07em] text-[var(--color-faint)]">
                      {block.durationMinutes} min session · side notes {block.personalRecordSideNotes ? "on" : "off"} · transcript:{" "}
                      {block.transcriptPolicy}
                    </p>
                  </div>
                  <RubricCard title="Rubric" criteria={block.criteria} />
                  <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[0.71875rem] leading-4 text-[var(--color-faint)]">
                    <span>Applying creates the AI assignment with this contract and rubric.</span>
                    <TextLink href={`/teach/work/${block.assignmentId}`} className="text-[0.71875rem]">
                      Open the assignment
                    </TextLink>
                  </p>
                </li>
              ) : block.type === "session_rubric" ? (
                <li key={index} className="px-3 py-2.5">
                  <RubricCard title={block.title} criteria={block.criteria} />
                  <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[0.71875rem] leading-4 text-[var(--color-faint)]">
                    <span>Applying writes the next rubric version for its AI assignment; grades already given stay pinned.</span>
                    <TextLink href={`/teach/ai-assignments/${block.assignmentId}`} className="text-[0.71875rem]">
                      Open the AI assignment
                    </TextLink>
                  </p>
                </li>
              ) : block.type === "practice_set" ? (
                <li key={index} className="px-3 py-2.5 text-[0.8125rem]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{block.title}</span>
                    <span className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">
                      {block.questions.length} question{block.questions.length === 1 ? "" : "s"}
                      {block.objectiveCodes.length > 0 ? ` \u00b7 ${block.objectiveCodes.join(" ")}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">{block.base}</p>
                  <ol className="mt-2 space-y-1">
                    {block.questions.slice(0, 3).map((question, qIndex) => (
                      <li key={qIndex} className="text-[0.75rem] leading-5 text-[var(--color-muted)]">
                        {qIndex + 1}. {question.prompt}
                      </li>
                    ))}
                    {block.questions.length > 3 ? (
                      <li className="text-[0.71875rem] text-[var(--color-faint)]">and {block.questions.length - 3} more on apply</li>
                    ) : null}
                  </ol>
                </li>
              ) : (
                <li key={index} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.8125rem]">
                  <span className="font-medium capitalize">{block.type.replaceAll("_", " ")}</span>
                  <span className="atlas-mono text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--color-faint)]">legacy draft</span>
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}

      {proposal.appliedRecords.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {proposal.appliedRecords.map((record) => (
            <TextLink key={record.href} href={record.href} className="text-[0.75rem]">
              {record.label}
            </TextLink>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <form action={reviewCourseProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <input type="hidden" name="decision" value="approved" />
            <ActionButton className="w-full">
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              <span className="ml-1.5">Apply</span>
            </ActionButton>
          </form>
          <form action={reviewCourseProposal}>
            <input type="hidden" name="proposalId" value={proposal.id} />
            <input type="hidden" name="decision" value="rejected" />
            <ActionButton variant="danger" className="w-full">
              <X size={14} strokeWidth={2} aria-hidden="true" />
              <span className="ml-1.5">Dismiss</span>
            </ActionButton>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function blockSummary(proposal: InstructorProposal) {
  if (proposal.blocks.length === 0) return proposal.kind;
  const counts = new Map<string, number>();
  for (const block of proposal.blocks) {
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => `${count} ${type.replaceAll("_", " ")}${count === 1 ? "" : "s"}`)
    .join(" / ");
}
