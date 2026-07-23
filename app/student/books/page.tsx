import { PageHeader } from "@/components/teach/page-header";
import { EmptyRecord } from "@/components/atlas/record";

export default function StudentBooksPage() {
  return (
    <>
      <PageHeader title="Books" />
      <p className="max-w-2xl text-[0.875rem] leading-6 text-[var(--color-muted)]">Required texts, library access, reserves, and course reading lists will live here.</p>
      <div className="mt-7 border-y border-[var(--color-border)]">
        <EmptyRecord title="No books listed" detail="Books added by your courses or university library will appear here." />
      </div>
    </>
  );
}
