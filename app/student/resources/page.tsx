import { PageHeader } from "@/components/teach/page-header";

const resourceGroups = [
  { name: "Academic support", detail: "Advising, tutoring, writing support, and accessibility services configured by your university." },
  { name: "Library and research", detail: "Databases, subject guides, archives, and librarian support configured by your university." },
  { name: "Student services", detail: "Registrar, financial aid, wellbeing, and other campus services configured by your university." },
];

export default function StudentResourcesPage() {
  return (
    <>
      <PageHeader title="University resources" />
      <p className="max-w-2xl text-[0.875rem] leading-6 text-[var(--color-muted)]">A home for the university services that support your work across courses.</p>
      <div className="mt-7 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {resourceGroups.map((group) => (
          <section key={group.name} className="py-4">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">{group.name}</h2>
            <p className="mt-1 max-w-2xl text-[0.8125rem] leading-5 text-[var(--color-muted)]">{group.detail}</p>
            <p className="mt-2 text-[0.71875rem] text-[var(--color-faint)]">No resources configured yet.</p>
          </section>
        ))}
      </div>
    </>
  );
}
