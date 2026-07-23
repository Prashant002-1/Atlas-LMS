import { redirect } from "next/navigation";

/** Compatibility redirect for links created before Assignments became canonical. */
export default async function LegacyTeachWorkPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  redirect(params.new === "1" ? "/teach/assignments?new=1" : "/teach/assignments");
}
