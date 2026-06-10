import { BrandMark } from "@/components/atlas/primitives";
import { SignInForm } from "@/components/atlas/sign-in-form";

type SignInPageProps = {
  searchParams?: Promise<{
    role?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const role = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const defaultRole = role === "student" ? "student" : "instructor";

  return (
    <main className="atlas-app-bg flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <SignInForm defaultRole={defaultRole} />
        <p className="mt-6 text-center text-[12px] leading-5 text-[var(--color-faint)]">
          Accounts are provisioned by your institution.
        </p>
      </div>
    </main>
  );
}
