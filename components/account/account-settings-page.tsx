import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadAccountProfile } from "@/lib/auth/account";
import { loadInstitutionName } from "@/lib/workspace/institution";
import { AccountProfileForm } from "@/components/account/account-profile-form";

export async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const profile = await loadAccountProfile(session.user.id);
  if (!profile) redirect("/sign-in");

  const institutionName = profile.orgId ? await loadInstitutionName(profile.orgId) : "Not assigned";
  const displayName = profile.name?.trim() || profile.email;

  return (
    <div className="max-w-[46rem]">
      <header className="border-b border-[var(--color-border)] pb-5">
        <h1 className="text-[1.375rem] font-semibold leading-7">Account settings</h1>
        <p className="mt-1 text-[0.8125rem] leading-6 text-[var(--color-muted)]">Your profile across Atlas.</p>
      </header>

      <section aria-labelledby="profile-heading" className="py-7">
        <h2 id="profile-heading" className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">Profile</h2>
        <AccountProfileForm name={displayName} email={profile.email} image={profile.image} />
      </section>

      <section aria-labelledby="account-heading" className="border-t border-[var(--color-border)] py-7">
        <h2 id="account-heading" className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">Account</h2>
        <dl className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)] text-[0.8125rem]">
          <AccountFact label="Email" value={profile.email} />
          <AccountFact label="Role" value={roleLabel(profile.role)} />
          <AccountFact label="Institution" value={institutionName} />
        </dl>
      </section>
    </div>
  );
}

function AccountFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[var(--color-faint)]">{label}</dt>
      <dd className="min-w-0 break-words text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function roleLabel(role: "superadmin" | "admin" | "instructor" | "ta" | "student") {
  const labels = {
    superadmin: "Super administrator",
    admin: "Administrator",
    instructor: "Instructor",
    ta: "Teaching assistant",
    student: "Student",
  };
  return labels[role];
}
