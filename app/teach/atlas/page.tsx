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
import { ActionButton, BackLink, Panel, StatusBadge } from "@/components/atlas/primitives";

/**
 * Atlas settings for a course — the professor's control object. Which cues
 * students get, how deep explanations go, the course's voice, and the org's
 * model key. This page IS the "professor decides the extent" doctrine.
 */
export default async function CourseAtlasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (!isInstructorLike(session.user.role)) {
    redirect("/student");
  }
  if (!session.user.orgId) {
    redirect("/teach");
  }

  const course = await findEditableCourse({ id: session.user.id, orgId: session.user.orgId, role: session.user.role });
  if (!course) {
    redirect("/teach");
  }

  const [policy] = await db
    .select()
    .from(courseAiPolicies)
    .where(and(eq(courseAiPolicies.orgId, session.user.orgId), eq(courseAiPolicies.courseId, course.id)))
    .limit(1);
  const keys = await listOrgProviderKeys(session.user.orgId);

  const checkbox =
    "size-4 accent-[var(--color-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]";
  const field =
    "min-h-10 rounded-[8px] border border-[var(--color-border)] bg-white px-3 text-[14px] text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]";

  return (
    <main className="atlas-app-bg min-h-screen px-5 py-8 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <BackLink href="/teach">Back to teaching</BackLink>
          <h1 className="mt-3 text-[24px] font-semibold leading-8">Atlas in {course.code}</h1>
          <p className="mt-1 text-[14px] leading-6 text-[var(--color-muted)]">
            You decide what Atlas may do for students in this course — which cues exist, how far an
            explanation goes, and in whose voice it speaks. Atlas never goes beyond this page.
          </p>
        </div>

        <Panel title="Student cues">
          <form action={updateCourseAiPolicy} className="grid gap-5">
            <div className="grid gap-3">
              <label className="flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="allowExplain" defaultChecked={policy?.allowExplain !== false} className={`mt-0.5 ${checkbox}`} />
                <span>
                  <span className="font-medium">Explain</span>
                  <span className="block text-[13px] leading-5 text-[var(--color-muted)]">
                    Students can ask Atlas to explain a record — what it asks, the idea underneath, the material behind it.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="allowPractice" defaultChecked={policy?.allowPractice !== false} className={`mt-0.5 ${checkbox}`} />
                <span>
                  <span className="font-medium">Practice</span>
                  <span className="block text-[13px] leading-5 text-[var(--color-muted)]">
                    Atlas can build practice from your course material, aligned to the record&rsquo;s objectives.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="allowQuestions" defaultChecked={policy?.allowQuestions !== false} className={`mt-0.5 ${checkbox}`} />
                <span>
                  <span className="font-medium">Quick questions</span>
                  <span className="block text-[13px] leading-5 text-[var(--color-muted)]">
                    One course question at a time, answered from the record. Anything it can&rsquo;t ground, it sends to you.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[12px] font-medium">
                How far explanations go
                <select name="explanationDepth" defaultValue={policy?.explanationDepth ?? "guided"} className={field}>
                  <option value="hint">Hint — point, never solve</option>
                  <option value="guided">Guided — walk the steps</option>
                  <option value="full">Full — complete explanations</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium">
                Daily requests per student
                <input name="studentDailyLimit" type="number" min={1} max={500} defaultValue={policy?.studentDailyLimit ?? 40} className={field} />
              </label>
            </div>

            <div className="grid gap-3 border-t border-[var(--color-border)] pt-4">
              <label className="flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="citationsRequired" defaultChecked={policy?.citationsRequired !== false} className={`mt-0.5 ${checkbox}`} />
                <span>
                  <span className="font-medium">Require citations</span>
                  <span className="block text-[13px] leading-5 text-[var(--color-muted)]">
                    Every claim must stand on a course record students can open.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-[14px]">
                <input type="checkbox" name="shareStruggleSignal" defaultChecked={policy?.shareStruggleSignal === true} className={`mt-0.5 ${checkbox}`} />
                <span>
                  <span className="font-medium">Class signal</span>
                  <span className="block text-[13px] leading-5 text-[var(--color-muted)]">
                    With each student&rsquo;s opt-in, you see which objectives the class asks about most — aggregates only, never a per-student feed.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid gap-4 border-t border-[var(--color-border)] pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-[12px] font-medium">
                  Course voice (optional)
                  <input name="personaName" type="text" placeholder="e.g. The Archivist" defaultValue={policy?.personaName ?? ""} className={field} />
                </label>
                <label className="grid gap-1.5 text-[12px] font-medium">
                  How the voice speaks
                  <input
                    name="personaStyle"
                    type="text"
                    placeholder="e.g. a measured 18th-century archivist; vivid, never silly"
                    defaultValue={policy?.personaStyle ?? ""}
                    className={field}
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-[12px] font-medium">
                Standing instructions (yours, injected into every student response)
                <textarea
                  name="customInstructions"
                  rows={3}
                  placeholder="e.g. Always work from the course's own datasets. Never reveal solutions to open problem sets."
                  defaultValue={policy?.customInstructions ?? ""}
                  className="min-h-20 resize-none rounded-[8px] border border-[var(--color-border)] bg-white px-3 py-2.5 text-[14px] leading-6 text-[var(--color-ink)] transition focus:border-[var(--color-accent-strong)]"
                />
              </label>
            </div>

            <div>
              <ActionButton>
                <Check size={14} strokeWidth={2} aria-hidden="true" />
                <span className="ml-1.5">Save policy</span>
              </ActionButton>
            </div>
          </form>
        </Panel>

        <Panel
          title="Model access"
          action={keys.length > 0 ? <StatusBadge tone="good">Connected</StatusBadge> : <StatusBadge tone="warn">Not connected</StatusBadge>}
        >
          <p className="text-[13px] leading-6 text-[var(--color-muted)]">
            Atlas runs on your organization&rsquo;s own model key. It is encrypted at rest and never leaves the
            server — only the last four characters are ever shown.
          </p>

          {keys.length > 0 ? (
            <div className="mt-4 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
              {keys.map((key) => (
                <div key={key.provider} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <KeyRound size={15} strokeWidth={2} aria-hidden className="text-[var(--color-muted)]" />
                    <div>
                      <p className="text-[14px] font-medium capitalize">{key.provider}</p>
                      <p className="atlas-mono text-[12px] text-[var(--color-muted)]">
                        ••••{key.keyTail}
                        {key.chatModel ? ` · ${key.chatModel}` : ""}
                      </p>
                    </div>
                  </div>
                  <form action={removeProviderKey}>
                    <input type="hidden" name="provider" value={key.provider} />
                    <ActionButton variant="danger" ariaLabel={`Remove ${key.provider} key`} title="Remove key">
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </ActionButton>
                  </form>
                </div>
              ))}
            </div>
          ) : null}

          <form action={saveProviderKey} className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4">
            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-[12px] font-medium">
                Provider
                <select name="provider" defaultValue="openrouter" className={field}>
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-[12px] font-medium">
                API key
                <input name="apiKey" type="password" required autoComplete="off" placeholder="sk-…" className={field} />
              </label>
            </div>
            <label className="grid gap-1.5 text-[12px] font-medium">
              Model (optional — sensible default otherwise)
              <input name="chatModel" type="text" placeholder="e.g. openai/gpt-4.1 or anthropic/claude-sonnet-4.5" className={field} />
            </label>
            <div>
              <ActionButton variant="secondary">
                <KeyRound size={14} strokeWidth={2} aria-hidden="true" />
                <span className="ml-1.5">Save key</span>
              </ActionButton>
            </div>
          </form>
        </Panel>
      </div>
    </main>
  );
}
