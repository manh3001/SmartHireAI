import { requireRole } from "@/lib/auth/session";
import Navbar from "@/components/Navbar";
import prisma from "@/lib/db/prisma";
import ProfileForm from "./ProfileForm";
import { headers } from "next/headers";
import { profileCompleteness } from "@/lib/candidates/completeness";
import ProfileCompleteness from "@/components/candidates/ProfileCompleteness";

export default async function SettingsProfilePage() {
  // requireRole redirects non-CANDIDATE automatically — no try/catch needed
  const session = await requireRole("CANDIDATE");

  const userId = session.user.id;
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      username: true,
      bio: true,
      github: true,
      linkedin: true,
      twitter: true,
      website: true,
    },
  });

  const cvCount = await prisma.cV.count({ where: { userId } });
  const completeness = profileCompleteness({
    hasCV: cvCount > 0,
    bio: profile?.bio ?? "",
    github: profile?.github ?? "",
    linkedin: profile?.linkedin ?? "",
    website: profile?.website ?? "",
  });

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const initial = {
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
    github: profile?.github ?? "",
    linkedin: profile?.linkedin ?? "",
    twitter: profile?.twitter ?? "",
    website: profile?.website ?? "",
  };

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-xl flex-1 p-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Hồ sơ cá nhân</h1>
        <div className="mb-6">
          <ProfileCompleteness result={completeness} />
        </div>
        <ProfileForm initial={initial} baseUrl={baseUrl} />
      </main>
    </div>
  );
}
