import { BookOpenCheck, FileText } from "lucide-react";
import { BrandMark, ButtonLink, IconLabel, PageFrame, Panel } from "@/components/atlas/primitives";
import { RecordFact } from "@/components/atlas/record";
import { SignInForm } from "@/components/atlas/sign-in-form";
import { atlasDemo } from "@/lib/demo/atlas";

type SignInPageProps = {
  searchParams?: Promise<{
    role?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const defaultRole = role === "student" ? "student" : "instructor";
  const liveModules = atlasDemo.modules.filter((module) => module.status === "approved").length;
  const draftModules = atlasDemo.modules.length - liveModules;

  return (
    <PageFrame>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <BrandMark />
        <ButtonLink href="/" variant="ghost" icon={false}>
          Overview
        </ButtonLink>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,0.95fr)_420px] lg:items-start">
        <section>
          <h1 className="atlas-serif max-w-xl text-[46px] font-semibold leading-[1.04] text-[var(--color-ink)] md:text-[58px]">
            Enter the course record.
          </h1>
          <Panel className="mt-8" title={atlasDemo.course.name} eyebrow={`${atlasDemo.course.code} · ${atlasDemo.course.term}`}>
            <div className="grid gap-5 border-b border-[var(--color-border)] pb-5 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <IconLabel icon={FileText}>Brief</IconLabel>
                <p className="mt-3 text-[15px] leading-6 text-[var(--color-ink)]">{atlasDemo.course.prompt}</p>
              </div>
              <div className="grid content-start gap-3 text-[13px]">
                <RecordFact label="Live" value={liveModules} />
                <RecordFact label="Draft" value={draftModules} />
                <RecordFact label="Objectives" value={atlasDemo.objectives.length} />
              </div>
            </div>
            <div className="pt-5">
              <IconLabel icon={BookOpenCheck}>Record</IconLabel>
              <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)]">Teach the course or study it.</p>
            </div>
          </Panel>
        </section>

        <SignInForm defaultRole={defaultRole} />
      </main>
    </PageFrame>
  );
}
