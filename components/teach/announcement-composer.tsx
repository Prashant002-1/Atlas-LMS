"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Markdown } from "@/components/agent/markdown";
import { ActionButton } from "@/components/atlas/primitives";
import { RecordDialog } from "@/components/teach/record-dialog";
import { createAnnouncementRecord, startAnnouncementDraftThread } from "@/lib/instructor/actions";
import { cn } from "@/lib/utils";

type ComposerMode = "write" | "atlas";
type ComposerStep = "compose" | "review";
type Delivery = "now" | "scheduled";

export function AnnouncementComposer({
  defaultOpen,
}: {
  defaultOpen: boolean;
}) {
  const [mode, setMode] = useState<ComposerMode>("write");
  const [step, setStep] = useState<ComposerStep>("compose");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [brief, setBrief] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const scheduledForIso = useMemo(() => {
    if (!scheduledFor) return "";
    const date = new Date(scheduledFor);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }, [scheduledFor]);

  return (
    <RecordDialog
      mode="create"
      triggerLabel="New announcement"
      title="New announcement"
      triggerVariant="primary"
      defaultOpen={defaultOpen}
      wide
    >
      <div className="mb-5 flex items-center gap-1 border-b border-[var(--color-border)]" role="tablist" aria-label="Announcement workflow">
        <ModeTab active={mode === "write"} onClick={() => { setMode("write"); setStep("compose"); }}>Write</ModeTab>
        <ModeTab active={mode === "atlas"} onClick={() => { setMode("atlas"); setStep("compose"); }}>Draft with Atlas</ModeTab>
      </div>

      {mode === "atlas" ? (
        <section aria-labelledby="atlas-announcement-heading">
          <h3 id="atlas-announcement-heading" className="text-[0.875rem] font-semibold text-[var(--color-ink)]">Start the draft</h3>
          <p className="mt-1 text-[0.75rem] leading-5 text-[var(--color-muted)]">Atlas opens a new thread with your request ready to send.</p>
          <form action={startAnnouncementDraftThread} className="mt-5 grid gap-4">
            <Field label="Subject" optional>
              <input
                name="subject"
                type="text"
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Exam 2 review and office hours"
                className={fieldClass}
              />
            </Field>
            <Field label="What should students know?">
              <textarea
                name="brief"
                rows={7}
                maxLength={2000}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                className={`${fieldClass} min-h-40 resize-y py-3 leading-6`}
              />
            </Field>
            <div className="mt-2 flex justify-end border-t border-[var(--color-border)] pt-4">
              <ActionButton disabled={!brief.trim()}>Continue in Atlas</ActionButton>
            </div>
          </form>
        </section>
      ) : step === "compose" ? (
        <section aria-labelledby="write-announcement-heading">
          <h3 id="write-announcement-heading" className="sr-only">Write announcement</h3>
          <div className="grid gap-4">
            <Field label="Subject">
              <input
                type="text"
                required
                autoFocus
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Exam 2 review and office hours"
                className={fieldClass}
              />
            </Field>
            <Field label="Message">
              <textarea
                rows={12}
                required
                maxLength={4000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className={`${fieldClass} min-h-64 resize-y py-3 leading-6`}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end border-t border-[var(--color-border)] pt-4">
            <ActionButton type="button" onClick={() => setStep("review")} disabled={!title.trim() || !message.trim()}>Review</ActionButton>
          </div>
        </section>
      ) : (
        <section aria-labelledby="review-announcement-heading">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <article className="min-w-0">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--color-faint)]">Preview</p>
              <h3 id="review-announcement-heading" className="atlas-serif mt-2 text-[1.25rem] font-semibold leading-7 text-[var(--color-ink)]">{title}</h3>
              <Markdown className="mt-5 text-[0.875rem] leading-7 text-[var(--color-muted)]">{message}</Markdown>
            </article>

            <form action={createAnnouncementRecord} className="border-t border-[var(--color-border)] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="message" value={message} />
              <input type="hidden" name="intent" value={delivery} />
              <input type="hidden" name="scheduledFor" value={scheduledForIso} />

              <fieldset>
                <legend className="text-[0.75rem] font-medium text-[var(--color-ink)]">Publication</legend>
                <div className="mt-3 grid gap-2">
                  <DeliveryOption checked={delivery === "now"} onChange={() => setDelivery("now")} label="Publish now" />
                  <DeliveryOption checked={delivery === "scheduled"} onChange={() => setDelivery("scheduled")} label="Schedule" />
                </div>
              </fieldset>

              {delivery === "scheduled" ? (
                <label className="mt-4 grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
                  Date and time
                  <input
                    type="datetime-local"
                    required
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              ) : null}

              <div className="mt-7 grid gap-2">
                <ActionButton disabled={delivery === "scheduled" && !scheduledForIso}>{delivery === "scheduled" ? "Schedule announcement" : "Publish announcement"}</ActionButton>
                <ActionButton type="button" variant="quiet" onClick={() => setStep("compose")}>Back to edit</ActionButton>
              </div>
            </form>
          </div>
        </section>
      )}
    </RecordDialog>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px min-h-10 border-b px-3 text-[0.78125rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]",
        active ? "border-[var(--color-ink)] text-[var(--color-ink)]" : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[0.75rem] font-medium text-[var(--color-ink)]">
      <span>{label}{optional ? <span className="ml-1 font-normal text-[var(--color-faint)]">Optional</span> : null}</span>
      {children}
    </label>
  );
}

function DeliveryOption({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-row px-2 text-[0.8125rem] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]">
      <input type="radio" checked={checked} onChange={onChange} className="size-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

const fieldClass = "min-h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] font-normal text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
