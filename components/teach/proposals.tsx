import { Check, X } from "lucide-react";
import { ActionButton, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { reviewCourseProposal } from "@/lib/instructor/actions";
import type { InstructorProposal } from "@/lib/instructor/workspace";

const tone = { pending: "good", approved: "good", rejected: "warn", applied: "accent" } as const;
const label = { pending: "Ready", approved: "Approved", rejected: "Dismissed", applied: "Applied" } as const;

export function ProposalCard({ proposal, compact = false }: { proposal: InstructorProposal; compact?: boolean }) {
  const open = proposal.status === "pending";

  return (
    <article className="atlas-card-hover rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5">{proposal.title}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{blockSummary(proposal)}</p>
        </div>
        <StatusBadge tone={tone[proposal.status]}>{label[proposal.status]}</StatusBadge>
      </div>

      {!compact && proposal.blocks.length > 0 ? (
        <div className="mt-4 space-y-3">
          <ul className="divide-y divide-[var(--color-border)] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
            {proposal.blocks.map((block, index) => (
              <li key={index} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="font-medium capitalize">{block.type.replaceAll("_", " ")}</span>
                <span className="atlas-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-faint)]">legacy draft</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {proposal.appliedRecords.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {proposal.appliedRecords.map((record) => (
            <TextLink key={record.href} href={record.href} className="text-[12px]">
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
