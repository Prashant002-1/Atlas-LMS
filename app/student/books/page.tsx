import { PageHeader } from "@/components/teach/page-header";
import { EmptyRecord } from "@/components/atlas/record";

export default function StudentBooksPage() {
  return (
    <>
      <PageHeader title="Books" />
      <div className="mt-7">
        <EmptyRecord title="No books listed" />
      </div>
    </>
  );
}
