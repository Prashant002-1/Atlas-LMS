import { Markdown } from "@/components/agent/markdown";
import { UserAvatar } from "@/components/atlas/user-avatar";
import { StatusBadge } from "@/components/atlas/primitives";

/**
 * An announcement, read the way mail is read.
 *
 * The plain version put the subject in the page header and left the body as
 * loose prose, so the two questions a reader asks first, who sent this and when,
 * were either missing or scattered. Mail answers both in one glance without
 * turning into a metadata table: sender with a face, recipient, timestamp, then
 * the subject, then the message.
 *
 * Shared by the read page and the composer's review step on purpose. A preview
 * that is a separate approximation of the real thing drifts from it, and then
 * the professor is approving something they did not actually see.
 */
export function AnnouncementMessage({
  subject,
  authorName,
  authorEmail,
  courseCode,
  audience,
  messageMd,
  stampLabel,
  scheduled = false,
  draft = false,
}: {
  subject: string;
  authorName: string;
  authorEmail?: string | null;
  courseCode: string;
  audience: string;
  messageMd: string;
  /** The already-formatted date line, or the composer's intent. */
  stampLabel: string;
  scheduled?: boolean;
  draft?: boolean;
}) {
  return (
    <article className="max-w-3xl">
      <header className="border-b border-[var(--color-border)] pb-5">
        <div className="flex items-start gap-3">
          <UserAvatar name={authorName} email={authorEmail ?? null} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[0.875rem] font-semibold text-[var(--color-ink)]">
                {authorName}
                {authorEmail ? (
                  <span className="ml-2 text-[0.75rem] font-normal text-[var(--color-faint)]">{authorEmail}</span>
                ) : null}
              </p>
              <p className="flex items-center gap-2 text-[0.75rem] tabular-nums text-[var(--color-muted)]">
                {draft ? <StatusBadge tone="neutral">Draft</StatusBadge> : null}
                {scheduled ? <StatusBadge tone="accent">Scheduled</StatusBadge> : null}
                <span>{stampLabel}</span>
              </p>
            </div>
            <p className="mt-0.5 text-[0.75rem] text-[var(--color-muted)]">
              To {audience}
              <span className="atlas-mono ml-2 text-[0.6875rem] uppercase tracking-[0.06em] text-[var(--color-faint)]">
                {courseCode}
              </span>
            </p>
          </div>
        </div>

        <h2 className="atlas-serif mt-5 text-[1.375rem] font-semibold leading-7 text-[var(--color-ink)]">
          {subject || "No subject"}
        </h2>
      </header>

      <div className="py-6">
        {messageMd.trim() ? (
          <Markdown className="text-[0.90625rem] leading-7">{messageMd}</Markdown>
        ) : (
          <p className="text-[0.8125rem] text-[var(--color-muted)]">No message.</p>
        )}
      </div>
    </article>
  );
}
