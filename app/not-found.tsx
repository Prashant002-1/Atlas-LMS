import { BrandMark, ButtonLink, PageFrame, Panel } from "@/components/atlas/primitives";

export default function NotFound() {
  return (
    <PageFrame>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-5 md:px-8">
        <BrandMark />
        <div className="grid flex-1 place-items-center py-12">
          <Panel>
            <p className="text-[13px] font-medium text-[var(--color-muted)]">404</p>
            <h1 className="atlas-serif mt-3 text-[44px] font-semibold leading-[1.05] text-[var(--color-ink)]">
              This page is not available.
            </h1>
            <p className="mt-4 text-[16px] leading-7 text-[var(--color-muted)]">
              Return to the course.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sign-in">Teach this course</ButtonLink>
              <ButtonLink href="/sign-in?role=student" variant="secondary">
                Study this course
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </main>
    </PageFrame>
  );
}
