import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Check, KeyRound, Trash2 } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { courseAiPolicies } from "@/lib/db/schema";
import { findEditableCourse } from "@/lib/instructor/workspace";
import { listOrgProviderKeys } from "@/lib/agent/keys";
import { removeProviderKey, saveProviderKey, updateCourseAiPolicy } from "@/lib/instructor/actions";
import { ActionButton, Panel, StatusBadge } from "@/components/atlas/primitives";

export default async function CourseAtlasPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInstructorLike(session.user.role)) redirect("/student");
  if (!session.user.orgId) redirect("/teach");

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) redirect("/teach");

  const [policy] = await db
    .select()
    .from(courseAiPolicies)
    .where(and(eq(courseAiPolicies.orgId, session.user.orgId), eq(courseAiPolicies.courseId, course.id)))
    .limit(1);
  const keys = await listOrgProviderKeys(session.user.orgId);

  const checkbox = "size-4 accent-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";
  const field = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.875rem] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[1.375rem] font-semibold leading-7">Settings</h1>
        <p className="mt-1 text-[0.875rem] leading-6 text-[var(--color-muted)]">
          What Atlas may do for students in {course.code}: which cues exist, how far an explanation goes, and in whose voice it speaks. Atlas never goes beyond this page.
        </p>
      </div>

      <Panel title="Student cues">
        <form action={updateCourseAiPolicy} className="grid gap-5">
          <div className="grid gap-3">
            <PolicyToggle name="allowExplain" defaultChecked={policy?.allowExplain !== false} checkbox={checkbox} title="Explain">
              Students can ask Atlas to explain an assignment or module, what it asks, the idea underneath, and the material behind it.
            </PolicyToggle>
            <PolicyToggle name="allowPractice" defaultChecked={policy?.allowPractice !== false} checkbox={checkbox} title="Practice">
              Atlas can build practice from your course material.
            </PolicyToggle>
            <PolicyToggle name="allowQuestions" defaultChecked={policy?.allowQuestions !== false} checkbox={checkbox} title="Quick questions">
              One course question at a time, answered from the course material. Anything it cannot ground, it sends to you.
            </PolicyToggle>
          </div>

          <div className="grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              How far explanations go
              <select name="explanationDepth" defaultValue={policy?.explanationDepth ?? "guided"} className={field}>
                <option value="hint">Hint, point, never solve</option>
                <option value="guided">Guided, walk the steps</option>
                <option value="full">Full, complete explanations</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Daily requests per student
              <input name="studentDailyLimit" type="number" min={1} max={500} defaultValue={policy?.studentDailyLimit ?? 40} className={field} />
            </label>
          </div>

          <div className="grid gap-3 border-t border-[var(--color-border)] pt-4">
            <PolicyToggle name="citationsRequired" defaultChecked={policy?.citationsRequired !== false} checkbox={checkbox} title="Require citations">
              Every claim must point to course material students can open.
            </PolicyToggle>
            <PolicyToggle name="shareStruggleSignal" defaultChecked={policy?.shareStruggleSignal === true} checkbox={checkbox} title="Class signal">
              With each student&apos;s opt-in, you see which topics the class asks about most, aggregates only, never a per-student feed.
            </PolicyToggle>
          </div>

          <div className="grid gap-4 border-t border-[var(--color-border)] pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                Course voice (optional)
                <input name="personaName" type="text" placeholder="e.g. The Archivist" defaultValue={policy?.personaName ?? ""} className={field} />
              </label>
              <label className="grid gap-1.5 text-[0.75rem] font-medium">
                How the voice speaks
                <input name="personaStyle" type="text" placeholder="e.g. measured and vivid, never silly" defaultValue={policy?.personaStyle ?? ""} className={field} />
              </label>
            </div>
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Standing instructions
              <textarea name="customInstructions" rows={3} placeholder="e.g. Always work from the course's own datasets. Never reveal solutions to open problem sets." defaultValue={policy?.customInstructions ?? ""} className="min-h-20 resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[0.875rem] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]" />
            </label>
          </div>

          <div>
            <ActionButton><Check size={14} strokeWidth={2} aria-hidden /><span className="ml-1.5">Save policy</span></ActionButton>
          </div>
        </form>
      </Panel>

      <Panel title="Model access" action={keys.length > 0 ? <StatusBadge tone="good">Connected</StatusBadge> : <StatusBadge tone="warn">Not connected</StatusBadge>}>
        <p className="text-[0.8125rem] leading-6 text-[var(--color-muted)]">
          Atlas runs on your organization&apos;s own model key. It is encrypted at rest and never leaves the server; only the last four characters are shown.
        </p>

        {keys.length > 0 ? (
          <div className="mt-4 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {keys.map((key) => (
              <div key={key.provider} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <KeyRound size={15} strokeWidth={2} aria-hidden className="text-[var(--color-muted)]" />
                  <div>
                    <p className="text-[0.875rem] font-medium capitalize">{key.provider}</p>
                    <p className="atlas-mono text-[0.75rem] text-[var(--color-muted)]">••••{key.keyTail}{key.chatModel ? ` · ${key.chatModel}` : ""}</p>
                  </div>
                </div>
                <form action={removeProviderKey}>
                  <input type="hidden" name="provider" value={key.provider} />
                  <ActionButton variant="danger" ariaLabel={`Remove ${key.provider} key`} title="Remove key"><Trash2 size={14} strokeWidth={2} aria-hidden /></ActionButton>
                </form>
              </div>
            ))}
          </div>
        ) : null}

        <form action={saveProviderKey} className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-[8.75rem_minmax(0,1fr)]">
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              Provider
              <select name="provider" defaultValue="openrouter" className={field}>
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[0.75rem] font-medium">
              API key
              <input name="apiKey" type="password" required autoComplete="off" placeholder="sk-..." className={field} />
            </label>
          </div>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Model (optional)
            <input name="chatModel" type="text" placeholder="e.g. openai/gpt-4.1" className={field} />
          </label>
          <div><ActionButton variant="secondary"><KeyRound size={14} strokeWidth={2} aria-hidden /><span className="ml-1.5">Save key</span></ActionButton></div>
        </form>
      </Panel>
    </div>
  );
}

function PolicyToggle({
  name,
  defaultChecked,
  checkbox,
  title,
  children,
}: {
  name: string;
  defaultChecked: boolean;
  checkbox: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 text-[0.875rem]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className={`mt-0.5 ${checkbox}`} />
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-[0.8125rem] leading-5 text-[var(--color-muted)]">{children}</span>
      </span>
    </label>
  );
}
