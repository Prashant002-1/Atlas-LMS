import { PageHeader } from "@/components/teach/page-header";

const resourceGroups = [
  "Academic support",
  "Library and research",
  "Student services",
];

export default function StudentResourcesPage() {
  return (
    <>
      <PageHeader title="University resources" />
      <div className="mt-7 divide-y divide-[var(--color-border)]">
        {resourceGroups.map((group) => (
          <section key={group} className="py-4">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--color-ink)]">{group}</h2>
            <p className="mt-2 text-[0.71875rem] text-[var(--color-faint)]">No resources configured.</p>
          </section>
        ))}
      </div>
    </>
  );
}
