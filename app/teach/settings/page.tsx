import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { agentProfiles } from "@/lib/agent/profiles";
import { scopeLabel } from "@/lib/workspace/term-label";
import { PageHeader } from "@/components/teach/page-header";
import { ButtonLink, TextLink } from "@/components/atlas/primitives";
import { listArchivedProfessorChats } from "@/lib/agent/chat-archive";
import { restoreProfessorAtlasChat } from "@/lib/agent/chat-actions";

/**
 * Settings is the small set of facts about this Atlas that a professor cannot
 * read anywhere else: which courses it reaches, where the student-facing
 * configuration lives, what the fixed boundaries are, and which chats are
 * archived.
 *
 * Deliberately absent:
 *
 * A capability list. Describing what Atlas can do is marketing inside a
 * product the professor has already bought, and it goes stale the moment a
 * tool changes. Asking Atlas is both current and shorter.
 *
 * A memory list. Atlas curates its own notes inside a hard budget, which is
 * the point of automatic memory: the professor is not the one maintaining it.
 * Anyone who wants to know can ask in a chat, where the answer is a sentence
 * rather than a table to audit.
 *
 * Explanations under headings. "System boundaries" already says it; adding
 * that no configuration loosens them is the reassurance copy this product
 * keeps removing.
 */
export default async function TeachSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) redirect("/teach");

  const [taughtRows, archivedChats] = await Promise.all([
    db
      .select({ id: courses.id, code: courses.code, name: courses.name, term: courses.term })
      .from(enrollments)
      .innerJoin(courses, and(eq(courses.id, enrollments.courseId), eq(courses.orgId, session.user.orgId)))
      .where(
        and(
          eq(enrollments.orgId, session.user.orgId),
          eq(enrollments.userId, session.user.id),
          eq(enrollments.role, "instructor"),
          eq(enrollments.state, "active")
        )
      )
      .orderBy(asc(courses.code)),
    listArchivedProfessorChats({ orgId: session.user.orgId, userId: session.user.id }),
  ]);

  return (
    <>
      <PageHeader
        title="Atlas"
        course={scopeLabel({ code: course.code, termName: course.term })}
        action={<ButtonLink href="/teach/atlas" size="sm">Open Atlas</ButtonLink>}
      />

      <section aria-labelledby="reach-heading" className="pb-8">
        <h2 id="reach-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Courses</h2>
        {taughtRows.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {taughtRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
                <span className="atlas-mono text-[0.71875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">{row.code}</span>
                <span className="min-w-0 flex-1 text-[0.8125rem] font-medium text-[var(--color-ink)]">{row.name}</span>
                <span className="text-[0.71875rem] text-[var(--color-muted)]">{row.term ?? ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 py-3 text-[0.8125rem] text-[var(--color-muted)]">No courses on record.</p>
        )}
        <p className="mt-3 text-[0.75rem] leading-5 text-[var(--color-muted)]">
          Atlas reads and writes only within your organization and the course in view. Every read and write is checked on the server.
        </p>
      </section>

      <section aria-labelledby="course-agent-pointer-heading" className="py-8">
        <h2 id="course-agent-pointer-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">The course agent</h2>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 py-3.5">
          <p className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">
            The agent students meet in {course.code} keeps its teaching behavior, rules, and version history in Course setup.
          </p>
          <TextLink href="/teach/course" className="text-[0.78125rem]">Open Course setup</TextLink>
        </div>
      </section>

      {archivedChats.length > 0 ? (
        <section aria-labelledby="archived-chats-heading" className="py-8">
          <h2 id="archived-chats-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Archived chats</h2>
          <ul className="mt-3 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {archivedChats.map((chat) => (
              <li key={chat.id} className="grid items-center gap-2 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-6">
                <span className="atlas-mono text-[0.71875rem] text-[var(--color-faint)]">{chat.courseCode}</span>
                <span className="min-w-0 truncate text-[0.8125rem] text-[var(--color-muted)]">{chat.title}</span>
                <form action={restoreProfessorAtlasChat}>
                  <input type="hidden" name="chatId" value={chat.id} />
                  <button type="submit" className="text-[0.71875rem] font-medium text-[var(--color-muted)] underline decoration-[color-mix(in_oklch,currentColor_40%,transparent)] underline-offset-[3px] transition hover:text-[var(--color-ink)]">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="system-boundaries-heading" className="py-8">
        <h2 id="system-boundaries-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">System boundaries</h2>
        <div className="mt-4 space-y-1">
          {[agentProfiles.professor, agentProfiles.session, agentProfiles.student].map((profileCard) => (
            <div key={profileCard.id} className="py-4">
              <p className="text-[0.8125rem] font-semibold text-[var(--color-ink)]">{profileCard.label}</p>
              <dl className="mt-2.5 grid gap-2">
                <SystemBoundaryRow label="Reads" items={profileCard.boundaries.reads} />
                <SystemBoundaryRow label="Writes" items={profileCard.boundaries.writes} />
                <SystemBoundaryRow label="Never" items={profileCard.boundaries.never} />
              </dl>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SystemBoundaryRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.71875rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 text-[0.75rem] leading-5 text-[var(--color-muted)]">{sentenceList(items)}</dd>
    </div>
  );
}

/** Join boundary phrases into one readable sentence-cased line. */
function sentenceList(items: string[]): string {
  if (items.length === 0) return "None";
  const joined = items.join("; ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
