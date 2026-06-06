import { Check, ClipboardCheck, Clock3, FileText, Layers3, Plus, X } from "lucide-react";
import { ProductShell } from "@/components/atlas/product-shell";
import { ActionButton, CodeList, CommandBand, IconLabel, Panel, StatusBadge } from "@/components/atlas/primitives";
import { EmptyRecord, ObjectiveMeter, RecordFact } from "@/components/atlas/record";
import { PracticeBaseStrip } from "@/components/atlas/practice-base";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { loadInstructorWorkspace, type InstructorWorkspace } from "@/lib/instructor/workspace";
import { draftCourseProposal, publishAssignment, publishModule, reviewCourseProposal } from "@/lib/instructor/actions";
import { practiceBaseForObjective } from "@/lib/practice/base";

const statusTone = {
  approved: "good",
  draft: "neutral",
  "needs-review": "warn",
} as const;

const statusLabel = {
  approved: "Live",
  draft: "Draft",
  "needs-review": "Review",
} as const;

const proposalTone = {
  ready: "good",
  pending: "good",
  "needs-edit": "warn",
  approved: "good",
  rejected: "warn",
  applied: "accent",
} as const;

const proposalLabel = {
  ready: "Ready",
  pending: "Ready",
  "needs-edit": "Needs edit",
  approved: "Approved",
  rejected: "Dismissed",
  applied: "Applied",
} as const;

export default async function TeachPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (session?.user && !isInstructorLike(session.user.role)) {
    redirect("/student");
  }
  const workspace = await loadInstructorWorkspace(session.user);
  const practiceBase = workspace.problem ? null : practiceBaseForObjective(priorityObjective(workspace.objectives)?.code);

  return (
    <ProductShell
      active="teach"
      persona="Instructor"
      title={workspace.course.name}
      subtitle={`${workspace.course.code} / ${workspace.course.term}`}
      actor={session?.user}
      rail={workspace.problem ? undefined : <InstructorRail workspace={workspace} />}
    >
      {workspace.problem ? (
        <WorkspaceProblem title={workspace.problem.title} detail={workspace.problem.detail} />
      ) : null}
      {workspace.problem ? null : <TeachingCommand workspace={workspace} />}

      <Panel
        title="Course map"
        eyebrow={workspace.course.code}
        action={<StatusBadge tone="neutral">{recordTotal(workspace.modules.length, workspace.assignments.length)}</StatusBadge>}
      >
        <div className="max-w-3xl border-b border-[var(--color-border)] pb-5">
          <IconLabel icon={FileText}>Brief</IconLabel>
          <p className="mt-3 text-[17px] leading-7 text-[var(--color-ink)]">{workspace.course.prompt}</p>
        </div>
        {practiceBase ? <PracticeBaseStrip base={practiceBase} /> : null}

        <div className="grid gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_300px]">
          <CourseStructure modules={workspace.modules} assignments={workspace.assignments} />
          <ObjectiveCoverage objectives={workspace.objectives} />
        </div>
      </Panel>
    </ProductShell>
  );
}

function CourseStructure({
  modules,
  assignments,
}: {
  modules: InstructorWorkspace["modules"];
  assignments: InstructorWorkspace["assignments"];
}) {
  return (
    <div className="min-w-0 space-y-6">
      <section>
        <div className="flex items-center justify-between gap-3 py-2">
          <IconLabel icon={Layers3}>Modules</IconLabel>
          <span className="text-[12px] text-[var(--color-muted)]">{modules.length}</span>
        </div>
        <ModuleSequence modules={modules} />
      </section>

      <section className="border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center justify-between gap-3 py-2">
          <IconLabel icon={ClipboardCheck}>Work</IconLabel>
          <span className="text-[12px] text-[var(--color-muted)]">{assignments.length}</span>
        </div>
        <AssessmentSequence assignments={assignments} />
      </section>
    </div>
  );
}

function ModuleSequence({ modules }: { modules: InstructorWorkspace["modules"] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {modules.length > 0 ? (
        modules.map((module) => (
          <article
            key={`${module.week}-${module.title}`}
            className="grid gap-3 py-4 first:pt-3 last:pb-0 md:grid-cols-[44px_minmax(0,1fr)_120px] md:items-center"
          >
            <span className="text-[13px] font-semibold text-[var(--color-faint)]">{module.week}</span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium leading-6 text-[var(--color-ink)]">{module.title}</h3>
              {module.summary ? <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{module.summary}</p> : null}
              <div className="mt-2">
                <CodeList codes={module.objectiveCodes} />
              </div>
            </div>
            <ModuleState module={module} />
          </article>
        ))
      ) : (
        <EmptyRecord title="No modules" detail="Modules will appear here when they are added to the course." />
      )}
    </div>
  );
}

function AssessmentSequence({ assignments }: { assignments: InstructorWorkspace["assignments"] }) {
  return (
    <div className="divide-y divide-[var(--color-border)]">
      {assignments.length > 0 ? (
        assignments.map((assignment) => (
          <article
            key={assignment.id ?? assignment.title}
            className="grid gap-3 py-4 first:pt-3 last:pb-0 md:grid-cols-[minmax(0,1fr)_120px] md:items-center"
          >
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium leading-6 text-[var(--color-ink)]">{assignment.title}</h3>
              {assignment.detail ? (
                <p className="mt-1 text-[13px] leading-5 text-[var(--color-muted)]">{assignment.detail}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {assignment.points ? <StatusBadge tone="neutral">{assignment.points} pts</StatusBadge> : null}
                <CodeList codes={assignment.objectiveCodes} />
              </div>
            </div>
            <AssignmentState assignment={assignment} />
          </article>
        ))
      ) : (
        <EmptyRecord title="No work" detail="Assignments will appear here when they are added to the course." />
      )}
    </div>
  );
}

function ObjectiveCoverage({ objectives }: { objectives: InstructorWorkspace["objectives"] }) {
  return (
    <aside className="border-t border-[var(--color-border)] pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Coverage</h3>
        <span className="text-[12px] text-[var(--color-muted)]">{objectives.length} objectives</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {objectives.length > 0 ? (
          objectives.map((objective) => (
            <ObjectiveMeter key={objective.code} objective={objective} progressLabel="Coverage" evidenceStyle="line" />
          ))
        ) : (
          <EmptyRecord title="No objectives" detail="Objectives will appear here when they are added to the course." />
        )}
      </div>
    </aside>
  );
}

function AssignmentState({ assignment }: { assignment: InstructorWorkspace["assignments"][number] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
      <StatusBadge tone={statusTone[assignment.status]}>{statusLabel[assignment.status]}</StatusBadge>
      {assignment.id && assignment.status === "draft" ? (
        <form action={publishAssignment}>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <ActionButton variant="quiet" ariaLabel={`Publish ${assignment.title}`} title={`Publish ${assignment.title}`}>
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            <span className="ml-1.5">Publish</span>
          </ActionButton>
        </form>
      ) : null}
    </div>
  );
}

function ModuleState({ module }: { module: InstructorWorkspace["modules"][number] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
      <StatusBadge tone={statusTone[module.status]}>{statusLabel[module.status]}</StatusBadge>
      {module.id && module.status === "draft" ? (
        <form action={publishModule}>
          <input type="hidden" name="moduleId" value={module.id} />
          <ActionButton variant="quiet" ariaLabel={`Publish week ${module.week}: ${module.title}`} title={`Publish week ${module.week}: ${module.title}`}>
            <Check size={14} strokeWidth={2} aria-hidden="true" />
            <span className="ml-1.5">Publish</span>
          </ActionButton>
        </form>
      ) : null}
    </div>
  );
}

function WorkspaceProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel title={title}>
      <p className="text-[14px] leading-6 text-[var(--color-muted)]">{detail}</p>
    </Panel>
  );
}

function TeachingCommand({ workspace }: { workspace: InstructorWorkspace }) {
  const reviewItems = workspace.proposals.filter((proposal) => proposal.status !== "applied" && proposal.status !== "rejected");
  const currentReview = reviewItems[0];
  const ready = workspace.proposals.filter((proposal) => proposal.status === "pending" || proposal.status === "ready").length;
  const live =
    workspace.modules.filter((module) => module.status === "approved").length +
    workspace.assignments.filter((assignment) => assignment.status === "approved").length;
  const drafts =
    workspace.modules.filter((module) => module.status !== "approved").length +
    workspace.assignments.filter((assignment) => assignment.status !== "approved").length;
  const gap = priorityObjective(workspace.objectives);
  const nextDraftModule = workspace.modules.find((module) => module.status !== "approved");
  const nextDraftAssignment = workspace.assignments.find((assignment) => assignment.status !== "approved");
  const next = nextDraftModule
    ? {
        eyebrow: "Next",
        title: `Publish week ${nextDraftModule.week}`,
        detail: nextDraftModule.title,
      }
    : nextDraftAssignment
      ? {
          eyebrow: "Next",
          title: "Publish work",
          detail: nextDraftAssignment.title,
        }
      : gap
        ? {
            eyebrow: "Focus",
            title: `Strengthen ${gap.code}`,
            detail: `${gap.title} is ${gap.coverage}% covered against ${gap.assessedWeight}% assessed weight.`,
          }
        : {
            eyebrow: "Current",
            title: "Course record is clear",
            detail: "No objective gaps are modeled yet.",
          };
  const command = currentReview
    ? {
        eyebrow: "Review",
        title: currentReview.title,
        detail: currentReview.summary,
      }
    : next;

  return (
    <CommandBand eyebrow={command.eyebrow} title={command.title} detail={command.detail}>
      <RecordFact label="Live" value={live} />
      <RecordFact label="Draft" value={drafts} />
      <RecordFact label="Review" value={ready} />
      <RecordFact label="Gap" value={gap ? `${gap.code} / ${gap.coverage}%` : "-"} />
    </CommandBand>
  );
}

function OutlineComposer({ focus }: { focus?: InstructorWorkspace["objectives"][number] }) {
  const placeholder = [
    focus ? `${focus.code}: ${focus.title}` : "LO1: Describe the core ideas students must know.",
    "Week 1: Course foundations - Establish vocabulary and shared notation LO1",
    "Assignment: Opening check - Short diagnostic aligned to LO1",
  ].join("\n");

  return (
    <div className="grid gap-4">
      <form action={draftCourseProposal} className="grid gap-3">
        <input type="hidden" name="kind" value="import" />
        <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
          Outline
          <textarea
            name="intent"
            placeholder={placeholder}
            required
            minLength={12}
            className="min-h-36 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
          />
        </label>
        <ActionButton className="w-full">
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Draft outline</span>
        </ActionButton>
      </form>

      <details>
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
          Single record
        </summary>
        <SingleRecordComposer focus={focus} />
      </details>
    </div>
  );
}

function SingleRecordComposer({ focus }: { focus?: InstructorWorkspace["objectives"][number] }) {
  const placeholder = focus ? `Strengthen ${focus.code}: ${focus.title}` : "Add one week, assignment, or objective.";

  return (
    <form action={draftCourseProposal} className="mt-3 grid gap-3">
      <label className="sr-only" htmlFor="single-record-kind">
        Record
      </label>
      <select
        id="single-record-kind"
        name="kind"
        defaultValue="module"
        className="min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
      >
        <option value="module">Week</option>
        <option value="assignment">Work</option>
        <option value="objective">Objective</option>
      </select>
      <label className="grid gap-2 text-[13px] font-medium text-[var(--color-ink)]">
        Change
        <textarea
          name="intent"
          placeholder={placeholder}
          required
          minLength={12}
          className="min-h-24 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-3 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
        />
      </label>
      <ActionButton className="w-full">
        <Plus size={14} strokeWidth={2} aria-hidden="true" />
        <span className="ml-1.5">Draft change</span>
      </ActionButton>
    </form>
  );
}

function InstructorRail({ workspace }: { workspace: InstructorWorkspace }) {
  const reviewItems = workspace.proposals.filter((proposal) => proposal.status !== "applied" && proposal.status !== "rejected");
  const ready = reviewItems.filter((proposal) => proposal.status === "pending" || proposal.status === "ready").length;
  const recentItems = workspace.proposals
    .filter((proposal) => proposal.status === "applied" || proposal.status === "rejected")
    .sort((a, b) => decisionTime(b) - decisionTime(a))
    .slice(0, 3);
  const focus = priorityObjective(workspace.objectives);
  const [current, ...later] = reviewItems;

  return (
    <div>
      <Panel
        title="Review"
        action={<StatusBadge tone={ready > 0 ? "good" : reviewItems.length > 0 ? "warn" : "neutral"}>{reviewItems.length}</StatusBadge>}
      >
        {current ? (
          <ReviewItem proposal={current} />
        ) : (
          <div className="py-2">
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">Clear</p>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">No drafts waiting.</p>
          </div>
        )}
        {later.length > 0 ? (
          <details className="mt-4 border-t border-[var(--color-border)] pt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
              {later.length} later
            </summary>
            <div className="mt-3 divide-y divide-[var(--color-border)]">
              {later.map((proposal) => (
                <ReviewItem key={proposal.id ?? proposal.title} proposal={proposal} compact />
              ))}
            </div>
          </details>
        ) : null}
        {recentItems.length > 0 ? <RecentDecisions proposals={recentItems} /> : null}

        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <p className="mb-3 text-[13px] font-semibold text-[var(--color-ink)]">Add change</p>
          <OutlineComposer focus={focus} />
        </div>
      </Panel>
    </div>
  );
}

function RecentDecisions({ proposals }: { proposals: InstructorWorkspace["proposals"] }) {
  return (
    <details className="mt-4 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Recent
      </summary>
      <div className="mt-3 divide-y divide-[var(--color-border)]">
        {proposals.map((proposal) => (
          <DecisionItem key={proposal.id ?? `${proposal.title}-${proposal.status}`} proposal={proposal} />
        ))}
      </div>
    </details>
  );
}

function DecisionItem({ proposal }: { proposal: InstructorWorkspace["proposals"][number] }) {
  const summary = uniqueText(proposal.summary, proposal.title) ? proposal.summary : null;
  const details = proposal.details.filter((detail) => uniqueText(detail, proposal.title, proposal.summary));

  return (
    <article className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-5 text-[var(--color-ink)]">{proposal.title}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{formatKind(proposal.kind)}</p>
        </div>
        <StatusBadge tone={proposalTone[proposal.status]}>{proposalLabel[proposal.status]}</StatusBadge>
      </div>
      {summary ? <p className="mt-2 text-[12px] leading-5 text-[var(--color-muted)]">{summary}</p> : null}
      {details.length > 0 ? (
        <div className="mt-2 space-y-1">
          {details.slice(0, 2).map((detail) => (
            <p key={detail} className="text-[12px] leading-5 text-[var(--color-faint)]">
              {detail}
            </p>
          ))}
        </div>
      ) : null}
      <ProposalMeta proposal={proposal} />
    </article>
  );
}

function ReviewItem({ proposal, compact = false }: { proposal: InstructorWorkspace["proposals"][number]; compact?: boolean }) {
  const readyProposalId = proposal.status === "pending" ? proposal.id : undefined;
  const summary = uniqueText(proposal.summary, proposal.title) ? proposal.summary : null;
  const details = proposal.details.filter((detail) => uniqueText(detail, proposal.title, proposal.summary));

  return (
    <article className={compact ? "py-3 first:pt-0 last:pb-0" : "py-1"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5 text-[var(--color-ink)]">{proposal.title}</p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">{formatKind(proposal.kind)}</p>
        </div>
        <StatusBadge tone={proposalTone[proposal.status]}>{proposalLabel[proposal.status]}</StatusBadge>
      </div>
      {!compact && summary ? <p className="mt-3 text-[13px] leading-5 text-[var(--color-muted)]">{summary}</p> : null}
      {!compact && details.length > 0 ? <ReviewDetails details={details} /> : null}
      <ProposalMeta proposal={proposal} />
      {readyProposalId ? <ProposalReviewActions proposalId={readyProposalId} /> : null}
    </article>
  );
}

function ReviewDetails({ details }: { details: string[] }) {
  return (
    <details className="mt-3 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer text-[12px] font-medium text-[var(--color-muted)] marker:text-[var(--color-faint)]">
        Details
      </summary>
      <div className="mt-3 space-y-2">
        {details.map((detail) => (
          <p key={detail} className="text-[13px] leading-5 text-[var(--color-muted)]">
            {detail}
          </p>
        ))}
      </div>
    </details>
  );
}

function ProposalReviewActions({ proposalId }: { proposalId: string }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <form action={reviewCourseProposal}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="decision" value="approved" />
        <ActionButton className="w-full">
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Apply</span>
        </ActionButton>
      </form>
      <form action={reviewCourseProposal}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="decision" value="rejected" />
        <ActionButton variant="danger" className="w-full">
          <X size={14} strokeWidth={2} aria-hidden="true" />
          <span className="ml-1.5">Dismiss</span>
        </ActionButton>
      </form>
    </div>
  );
}

function ProposalMeta({ proposal }: { proposal: InstructorWorkspace["proposals"][number] }) {
  const created = formatDate(proposal.createdAt);
  const decided = formatDate(proposal.decidedAt);
  const label = decided ? `Decided ${decided}` : created ? `Drafted ${created}` : null;

  if (!label) return null;

  return (
    <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-faint)]">
      <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function formatDate(value?: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatKind(value: string) {
  const labels: Record<string, string> = {
    module: "Week",
    assignment: "Work",
    objective: "Objective",
    import: "Outline",
  };
  if (labels[value]) return labels[value];

  return value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function recordTotal(modules: number, assignments: number) {
  const weekLabel = modules === 1 ? "week" : "weeks";
  const workLabel = assignments === 1 ? "work item" : "work items";
  return `${modules} ${weekLabel} / ${assignments} ${workLabel}`;
}

function decisionTime(proposal: InstructorWorkspace["proposals"][number]) {
  return proposal.decidedAt?.getTime() ?? proposal.createdAt?.getTime() ?? 0;
}

function uniqueText(value: string, ...existing: string[]) {
  const normalized = normalizeText(value);
  return Boolean(normalized) && existing.every((item) => normalizeText(item) !== normalized);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "").toLowerCase();
}

function priorityObjective(objectives: InstructorWorkspace["objectives"]) {
  return [...objectives].sort((a, b) => b.assessedWeight * (100 - b.coverage) - a.assessedWeight * (100 - a.coverage))[0];
}
