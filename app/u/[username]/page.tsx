import { notFound } from "next/navigation";
import Link from "next/link";
import { Link as LinkIcon, Globe, ExternalLink, FileText } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyAvatar from "@/components/CompanyAvatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type Props = { params: Promise<{ username: string }> };

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;

  const profile = await prisma.candidateProfile.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      userId: true,
      username: true,
      bio: true,
      github: true,
      linkedin: true,
      twitter: true,
      website: true,
      user: {
        select: {
          name: true,
          cvs: {
            where: { shareToken: { not: null } },
            select: { id: true, title: true, template: true, shareToken: true },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          },
        },
      },
    },
  });

  if (!profile) notFound();

  // Headline từ CV mặc định (query riêng — CV isDefault có thể không phải CV public)
  const headlineCv = await prisma.cV.findFirst({
    where: { userId: profile.userId, isDefault: true },
    select: { profile: { select: { headline: true } } },
  });
  const headline = headlineCv?.profile?.headline ?? "";

  const socialLinks = [
    { href: profile.github, icon: LinkIcon, label: "GitHub" },
    { href: profile.linkedin, icon: LinkIcon, label: "LinkedIn" },
    { href: profile.twitter, icon: LinkIcon, label: "Twitter/X" },
    { href: profile.website, icon: Globe, label: "Website" },
  ].filter((l) => l.href);

  const publicCvs = profile.user.cvs;

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <CompanyAvatar name={profile.user.name} className="h-16 w-16 rounded-2xl text-lg" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{profile.user.name}</h1>
            {headline && <p className="text-muted-foreground">{headline}</p>}
            {profile.bio && (
              <p className="mt-2 text-sm text-foreground">{profile.bio}</p>
            )}
            {socialLinks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {socialLinks.map(({ href, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={href.startsWith("http") ? href : `https://${href}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CV công khai */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">CV công khai</h2>
          {publicCvs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Chưa có CV công khai"
              description="Ứng viên chưa chia sẻ CV nào."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {publicCvs.map((cv) => (
                <div
                  key={cv.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-4"
                >
                  <div>
                    <div className="font-medium text-foreground">{cv.title || "(chưa đặt tên)"}</div>
                    <Badge variant="muted" className="mt-1 text-xs capitalize">
                      {cv.template}
                    </Badge>
                  </div>
                  <Link
                    href={`/cv/share/${cv.shareToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Xem CV
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
