import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { searchCandidates } from "@/lib/candidates/search";
import CandidateSearch from "./CandidateSearch";

export const dynamic = "force-dynamic";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; exp?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const { q, exp } = await searchParams;
  const candidates = await searchCandidates({ q, exp });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <h1 className="text-xl font-semibold text-foreground">Tìm ứng viên</h1>
        <CandidateSearch
          initialCandidates={candidates}
          initialQ={q ?? ""}
          initialExp={exp ?? ""}
        />
      </main>
    </div>
  );
}
