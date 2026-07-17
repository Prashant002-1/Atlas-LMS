import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadAiAssignmentIndex } from "@/lib/instructor/cockpit";
import { PageHeader } from "@/components/teach/page-header";
import { ButtonLink, TextLink } from "@/components/atlas/primitives";
import { EmptyState } from "@/components/atlas/record";

/**
 * The course's AI assignments as records to inspect and govern.
 * JourneyGridSummary was replaced by explicit table columns in this redesign.
 */
export default async function TeachAiAssignmentsPage() {
  const session = await auth();
  const view = await loadAiAssignmentIndex(session?.user);

  if (view.problem) {
    return (
      <>
        <PageHeader title="AI assignments" />
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AI assignments"
        course={`${view.course.code} / ${view.course.name}`}
        action={<ButtonLink href="/teach/settings" variant="secondary" size="sm">AI settings</ButtonLink>}
      />

      {view.rows.length > 0 ? (
        <div className="overflow-hidden border-b border-[var(--color-border)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left">
              <thead>
                <tr className="text-[0.71875rem] text-[var(--color-muted)]">
                  <th scope="col" className="px-3 py-2.5 font-medium">Assignment</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Session</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Submitted</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Draft grades</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Graded</th>
                  <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {view.rows.map((row) => {
                  const draftGrades = row.counts ? row.counts.draft + row.counts.reviewRequested : null;
                  const href = `/teach/ai-assignments/${row.assignmentId}`;
                  return (
                    <tr key={row.assignmentId} className="text-[0.8125rem] transition hover:bg-[var(--color-surface-muted)]">
                      <th scope="row" className="px-3 py-3.5 font-medium text-[var(--color-ink)]">
                        <Link href={href} className="rounded-row underline decoration-[color-mix(in_oklch,var(--color-ink)_25%,transparent)] underline-offset-[3px] hover:text-[var(--color-accent-strong)]">{row.name}</Link>
                        {!row.published ? <span className="ml-2 text-[0.71875rem] font-normal text-[var(--color-muted)]">Draft</span> : null}
                      </th>
                      <td className="px-3 py-3.5 tabular-nums text-[var(--color-muted)]">{row.dueAt ? shortDate(row.dueAt) : "-"}</td>
                      <td className="px-3 py-3.5 text-[var(--color-muted)]">{row.durationMinutes} min</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{row.counts?.submitted ?? "-"}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{draftGrades ?? "-"}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[var(--color-ink)]">{row.counts?.final ?? "-"}</td>
                      <td className="px-3 py-3.5 text-right">
                        <Link href={href} aria-label={`Open ${row.name}`} className="inline-flex rounded-row text-[var(--color-faint)] transition hover:translate-x-0.5 hover:text-[var(--color-ink)]"><ChevronRight size={15} aria-hidden /></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          art="atlas"
          title="No AI assignments"
          detail="Set one up in a conversation with Atlas."
          action={<TextLink href="/teach/atlas" className="text-[0.8125rem]">Open Atlas</TextLink>}
        />
      )}
    </>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
