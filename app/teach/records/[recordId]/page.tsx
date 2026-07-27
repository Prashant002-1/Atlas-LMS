import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { loadCourseRecord } from "@/lib/instructor/course-records";
import { Markdown } from "@/components/agent/markdown";
import { PageHeader } from "@/components/teach/page-header";
import { BackLink, StatusBadge } from "@/components/atlas/primitives";
import { EmptyRecord } from "@/components/atlas/record";
import { moduleReturnHref } from "@/lib/module-navigation-context";

/**
 * One page or practice set, in full.
 *
 * Modules, assignments, and announcements each already had somewhere to live,
 * so a draft that created one could be opened after approval. Pages and
 * practice sets could be created by Atlas and then never read, which left
 * Review with an approved draft and nowhere to send you. This is that place.
 */
export default async function CourseRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ fromModule?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");

  const [{ recordId }, query] = await Promise.all([params, searchParams]);
  const moduleHref = moduleReturnHref(query.fromModule);
  const backHref = moduleHref ?? "/teach/materials";
  const backLabel = moduleHref ? "Module" : "Materials";
  const view = await loadCourseRecord(session.user, recordId);

  if (view.problem) {
    return (
      <>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <div className="mt-3"><PageHeader title={view.problem.title} /></div>
        <p className="max-w-lg text-[0.875rem] leading-6 text-[var(--color-muted)]">{view.problem.detail}</p>
      </>
    );
  }

  if (!view.record) {
    return (
      <>
        <BackLink href={backHref}>{backLabel}</BackLink>
        <div className="mt-3">
          <PageHeader title="Record not found" course={view.course.code} />
        </div>
        <EmptyRecord title="Not in this course" detail="This record does not exist in the course you are teaching." />
      </>
    );
  }

  const record = view.record;
  const kindLabel = record.kind === "page" ? "Page" : "Practice set";

  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <div className="mt-3">
        <PageHeader
          title={record.title}
          course={`${view.course.code} / ${kindLabel}`}
          action={record.published ? undefined : <StatusBadge tone="neutral">Draft</StatusBadge>}
        />
      </div>

      <p className="-mt-4 text-[0.75rem] text-[var(--color-faint)]">
        {record.updatedAt
          ? `Updated ${record.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : null}
      </p>

      {record.kind === "page" ? (
        record.bodyMd ? (
          <Markdown className="mt-7 max-w-3xl text-[0.875rem] leading-7">{record.bodyMd}</Markdown>
        ) : (
          <p className="mt-7 text-[0.8125rem] text-[var(--color-muted)]">This page has no body yet.</p>
        )
      ) : (
        <div className="mt-7 max-w-3xl">
          {record.base ? (
            <p className="text-[0.875rem] leading-7 text-[var(--color-muted)]">{record.base}</p>
          ) : null}
          {record.questions.length > 0 ? (
            <ol className="mt-6 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
              {record.questions.map((question, index) => (
                <li key={index} className="py-5">
                  <p className="text-[0.875rem] font-medium leading-6 text-[var(--color-ink)]">
                    {index + 1}. {question.prompt}
                  </p>
                  {question.options?.length ? (
                    <ul className="mt-2.5 space-y-1">
                      {question.options.map((option, optionIndex) => (
                        <li key={optionIndex} className="text-[0.8125rem] leading-5 text-[var(--color-muted)]">
                          {option}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-3 text-[0.8125rem] leading-5 text-[var(--color-ink)]">
                    <span className="text-[var(--color-faint)]">Answer </span>
                    {question.answer}
                  </p>
                  <Markdown className="mt-1.5 text-[0.78125rem] leading-6 text-[var(--color-muted)]">
                    {question.rationaleMd}
                  </Markdown>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-6 text-[0.8125rem] text-[var(--color-muted)]">This set has no questions yet.</p>
          )}
        </div>
      )}
    </>
  );
}
