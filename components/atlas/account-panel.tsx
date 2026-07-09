import { LogOut } from "lucide-react";
import { signOutOfAtlas } from "@/lib/auth/actions";
import { Panel } from "@/components/atlas/primitives";
import { RecordFact } from "@/components/atlas/record";
import { ThemeSwitch } from "@/components/atlas/theme-switch";

/**
 * The Account page body, shared by both workspaces: who is signed in,
 * the theme choice, and sign out. Facts and direct controls, nothing else.
 */
export function AccountPanel({
  name,
  email,
  role,
  organization,
}: {
  name?: string | null;
  email?: string | null;
  role: string;
  organization?: string | null;
}) {
  const displayName = name?.trim() || email?.trim() || "Account";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-xl space-y-4">
      <Panel>
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-indigo-soft)] text-[16px] font-semibold text-[var(--color-accent-strong)]">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold text-[var(--color-ink)]">{displayName}</span>
            {email ? <span className="block truncate text-[13px] text-[var(--color-muted)]">{email}</span> : null}
          </span>
        </div>
        <div className="mt-5 grid gap-3 border-t border-[var(--color-border)] pt-4 text-[13px]">
          <RecordFact label="Role" value={roleLabel(role)} />
          {organization ? <RecordFact label="Organization" value={organization} /> : null}
        </div>
      </Panel>

      <Panel title="Theme">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] leading-5 text-[var(--color-muted)]">How Atlas renders for this browser.</p>
          <ThemeSwitch />
        </div>
      </Panel>

      <Panel>
        <form action={signOutOfAtlas} className="flex items-center justify-between gap-4">
          <p className="text-[13px] leading-5 text-[var(--color-muted)]">End this session on this device.</p>
          <button
            type="submit"
            className="inline-flex min-h-9 items-center gap-2 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-ink)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)]"
          >
            <LogOut size={14} strokeWidth={2} aria-hidden />
            Sign out
          </button>
        </form>
      </Panel>
    </div>
  );
}

function roleLabel(role: string): string {
  if (role === "instructor") return "Instructor";
  if (role === "ta") return "Teaching assistant";
  if (role === "student") return "Student";
  if (role === "admin" || role === "superadmin") return "Administrator";
  return role;
}
