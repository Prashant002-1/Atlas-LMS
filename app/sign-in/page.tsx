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
  const showDemoEmails = process.env.ATLAS_SHOW_DEMO_EMAILS === "1";
  const suggestedEmail = showDemoEmails
    ? defaultRole === "student"
      ? "student@demo.edu"
      : "instructor@demo.edu"
    : undefined;

  return (
    <main className="atlas-app-bg flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <SignInForm suggestedEmail={suggestedEmail} />
      </div>
    </main>
  );
}
