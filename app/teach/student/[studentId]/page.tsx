import { UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { BackLink, IconLabel, Panel, StatusBadge, TextLink } from "@/components/atlas/primitives";
import { EmptyRecord, RecordFact } from "@/components/atlas/record";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import {
  loadInstructorStudentWorkspace,
  type InstructorStudentWorkItem,
  type InstructorStudentWorkspace,
} from "@/lib/instructor/workspace";
import { markdownPreview } from "@/lib/markdown-presentation";

const workTone = { graded: "good", submitted: "accent", missing: "warn", open: "neutral" } as const;
const workLabel = { graded: "Graded", submitted: "Submitted", missing: "Missing", open: "Open" } as const;

export default async function InstructorStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const { studentId } = await params;
  const workspace = await loadInstructorStudentWorkspace(session.user, studentId);

  return (
    <>
      <BackLink href="/teach/students">Students</BackLink>
      {workspace.problem || !workspace.student ? (
        <Panel title={workspace.problem?.title ?? "Student unavailable"}>
          <p className="text-[0.875rem] leading-6 text-[var(--color-muted)]">{workspace.problem?.detail ?? "This student is not enrolled in a course you teach."}</p>
        </Panel>
      ) : (
        <>
          <StudentRecord workspace={workspace} />
          <StudentWorkList work={workspace.work} />
        </>
      )}
    </>
  );
}

function StudentRecord({ workspace }: { workspace: InstructorStudentWorkspace }) {
  const student = workspace.student;
  if (!student) return null;
  return (
    <Panel title={student.name} action={<StatusBadge tone="neutral">{student.standing}</StatusBadge>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0">
          <IconLabel icon={UsersRound}>Roster</IconLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <RecordFact label="Submitted" value={student.submitted} variant="stack" />
            <RecordFact label="Graded" value={student.graded} variant="stack" />
            <RecordFact label="Open" value={student.open} variant="stack" />
            <RecordFact label="Missing" value={student.missing} variant="stack" />
          </div>
        </section>
        <aside className="grid content-start gap-3 border-t border-[var(--color-border)] pt-4 text-[0.8125rem] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <RecordFact label="Standing" value={student.standing} />
          <RecordFact label="Assignments" value={workspace.work.length} />
          <RecordFact label="Last active" value={student.lastActivityAt ? formatShortDate(student.lastActivityAt) : "-"} />
        </aside>
      </div>
    </Panel>
  );
}

function StudentWorkList({ work }: { work: InstructorStudentWorkItem[] }) {
  return (
    <Panel title="Assignments" action={<StatusBadge tone="neutral">{work.length}</StatusBadge>}>
      <div className="divide-y divide-[var(--color-border)]">
        {work.length > 0 ? work.map((item) => <StudentWorkRow key={item.assignmentId ?? item.title} item={item} />) : <EmptyRecord title="No assignments" />}
      </div>
    </Panel>
  );
}

function StudentWorkRow({ item }: { item: InstructorStudentWorkItem }) {
  const score = item.grade ?? scoreLabel(item);
  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold leading-5 text-[var(--color-ink)]">
            {item.assignmentId ? <TextLink href={`/teach/assignments/${item.assignmentId}`}>{item.title}</TextLink> : item.title}
          </p>
          <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">{workMeta(item)}</p>
          {item.detail ? <p className="mt-2 text-[0.8125rem] leading-5 text-[var(--color-muted)]">{markdownPreview(item.detail, item.title)}</p> : null}
          {item.points ? <p className="mt-2 text-[0.75rem] text-[var(--color-muted)]">{Math.round(item.points)} points</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {score ? <StatusBadge tone="neutral">{score}</StatusBadge> : null}
          <StatusBadge tone={workTone[item.status]}>{workLabel[item.status]}</StatusBadge>
        </div>
      </div>
      {item.body?.trim() ? (
        <div className="mt-3 pt-3">
          <p className="text-[0.75rem] font-medium text-[var(--color-ink)]">Response</p>
          <p className="mt-2 text-[0.8125rem] leading-6 text-[var(--color-muted)]">{item.body.trim()}</p>
        </div>
      ) : null}
    </article>
  );
}

function workMeta(item: InstructorStudentWorkItem) {
  if (item.gradedAt) return `Graded ${formatShortDate(item.gradedAt)}`;
  if (item.submittedAt) return `Submitted ${formatShortDate(item.submittedAt)}`;
  if (item.dueAt) return `Due ${formatShortDate(item.dueAt)}`;
  return item.status === "missing" ? "Missing" : "No due date";
}

function scoreLabel(item: InstructorStudentWorkItem) {
  if (typeof item.score !== "number") return null;
  if (typeof item.points === "number" && item.points > 0) return `${Math.round(item.score)}/${Math.round(item.points)}`;
  return `${Math.round(item.score)}%`;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}
