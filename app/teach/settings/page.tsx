import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { loadAccountProfile } from "@/lib/auth/account";
import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { listActiveMemories, MEMORY_ACTIVE_BUDGET_CHARS } from "@/lib/agent/memories";
import { agentProfiles } from "@/lib/agent/profiles";
import { PageHeader } from "@/components/teach/page-header";
import { ButtonLink, TextLink } from "@/components/atlas/primitives";
import { listArchivedProfessorChats } from "@/lib/agent/chat-archive";
import { restoreProfessorAtlasChat } from "@/lib/agent/chat-actions";

/**
 * Settings describes the professor's own Atlas: who it works for, what it
 * can do, what it remembers, and the fixed boundaries of every profile.
 * The course agent that faces students is a course record and lives in
 * Course setup. Nothing here is a form; the agent maintains its own memory
 * and the platform owns the runtime.
 */
export default async function TeachSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) redirect("/teach");

  const [profile, taughtRows, memories, archivedChats] = await Promise.all([
    loadAccountProfile(session.user.id),
    db
      .select({ id: courses.id, code: courses.code, name: courses.name })
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
    listActiveMemories({ orgId: session.user.orgId, userId: session.user.id, profile: "professor" }),
    listArchivedProfessorChats({ orgId: session.user.orgId, userId: session.user.id }),
  ]);

  const displayName = profile?.name?.trim() || session.user.name || "you";
  const memoryUsed = memories.reduce((sum, memory) => sum + memory.content.length, 0);
  const codeById = new Map(taughtRows.map((row) => [row.id, row.code]));

  return (
    <>
      <PageHeader
        title="Atlas"
        course={`works for ${displayName}`}
        action={<ButtonLink href="/teach/atlas" size="sm">Open Atlas</ButtonLink>}
      />

      <section aria-labelledby="works-for-heading" className="pb-8">
        <h2 id="works-for-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Works for you</h2>
        <dl className="mt-3 space-y-1">
          <FactRow label="Instructor" value={displayName} />
          {profile?.title ? <FactRow label="Title" value={profile.title} /> : null}
          <FactRow
            label="Courses"
            value={taughtRows.length > 0 ? taughtRows.map((row) => `${row.code} ${row.name}`).join(" / ") : "None on record"}
          />
          <FactRow label="Scope" value="Your organization and the course in view. Every read and write is checked on the server." />
        </dl>
      </section>

      <section aria-labelledby="cando-heading" className="py-8">
        <h2 id="cando-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">What Atlas can do</h2>
        <ul className="mt-3 divide-y divide-[var(--color-border)] text-[0.8125rem] leading-5 text-[var(--color-muted)]">
          <li className="px-3 py-2.5">Read the whole course: records, roster, grades, submissions, sessions, and results</li>
          <li className="px-3 py-2.5">Operate the LMS through typed actions when you ask: records, grades, publishing, announcements</li>
          <li className="px-3 py-2.5">Draft AI assignments, rubrics, and course work for your decision in Review</li>
          <li className="px-3 py-2.5">Configure the course agent from conversation, as append-only versions</li>
          <li className="px-3 py-2.5">Keep a small set of durable notes about how you work</li>
        </ul>
      </section>

      <section aria-labelledby="remembers-heading" className="py-8">
        <h2 id="remembers-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">
          What Atlas remembers
          {memories.length > 0 ? (
            <span className="ml-2.5 text-[0.75rem] font-normal text-[var(--color-faint)]">
              {memories.length} notes / {memoryUsed} of {MEMORY_ACTIVE_BUDGET_CHARS} chars
            </span>
          ) : null}
        </h2>
        {memories.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {memories.map((memory) => (
              <li key={memory.id} className="grid gap-1 px-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
                <span className="text-[0.71875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                  {memory.kind}
                  {memory.courseId && codeById.get(memory.courseId) ? (
                    <span className="atlas-mono ml-1.5 normal-case tracking-normal">{codeById.get(memory.courseId)}</span>
                  ) : null}
                </span>
                <span className="min-w-0 text-[0.8125rem] leading-5 text-[var(--color-ink)]">{memory.content}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 px-3 py-4 text-[0.8125rem] text-[var(--color-muted)]">
            Nothing yet. Atlas records observations as you work with it, within a hard budget it curates itself.
          </p>
        )}
      </section>

      {archivedChats.length > 0 ? (
        <section aria-labelledby="archived-chats-heading" className="py-8">
          <h2 id="archived-chats-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">Archived chats</h2>
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {archivedChats.map((chat) => (
              <li key={chat.id} className="grid items-center gap-2 px-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-6">
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

      <section aria-labelledby="course-agent-pointer-heading" className="py-8">
        <h2 id="course-agent-pointer-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">The course agent</h2>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 px-3 py-3.5">
          <p className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">
            The agent students meet in {course.code} is a course record: its teaching behavior, rules, and version history live in Course setup.
          </p>
          <TextLink href="/teach/course" className="text-[0.78125rem]">Open Course setup</TextLink>
        </div>
      </section>

      <section aria-labelledby="system-boundaries-heading" className="py-8">
        <h2 id="system-boundaries-heading" className="text-[1rem] font-semibold text-[var(--color-ink)]">System boundaries</h2>
        <p className="mt-1 text-[0.75rem] text-[var(--color-muted)]">Fixed for every Atlas profile. No configuration loosens them.</p>
        <div className="mt-4 space-y-1">
          {[agentProfiles.professor, agentProfiles.session, agentProfiles.student].map((profileCard) => (
            <div key={profileCard.id} className="py-4">
              <p className="px-3 text-[0.8125rem] font-semibold text-[var(--color-ink)]">{profileCard.label}</p>
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

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-[0.75rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 text-[0.8125rem] font-medium leading-5 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function SystemBoundaryRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid gap-1 px-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
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
