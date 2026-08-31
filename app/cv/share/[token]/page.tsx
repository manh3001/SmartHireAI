import { notFound } from "next/navigation";
import { Mail, Phone, Linkedin, Globe, Download } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { loadCvInput } from "@/lib/cv/load";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";
import CvPreview from "@/components/cv/CvPreview";
import CompanyAvatar from "@/components/CompanyAvatar";
import { buttonVariants } from "@/components/ui/button";

export default async function ShareCvPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const cv = await prisma.cV.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      userId: true,
      title: true,
      template: true,
      accent: true,
      font: true,
      profile: {
        select: {
          fullName: true,
          headline: true,
          email: true,
          phone: true,
          linkedin: true,
          portfolio: true,
        },
      },
    },
  });

  if (!cv) notFound();

  const cvInput = await loadCvInput(cv.id, cv.userId);
  if (!cvInput) notFound();

  const profile = cv.profile;
  const displayName = profile?.fullName || cv.title;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header hồ sơ */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CompanyAvatar name={displayName} className="h-14 w-14 text-base" />
            <div>
              <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
              {profile?.headline && (
                <p className="text-sm text-muted-foreground">{profile.headline}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {profile?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {profile.email}
                  </span>
                )}
                {profile?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {profile.phone}
                  </span>
                )}
                {profile?.linkedin && (
                  <a
                    href={profile.linkedin.startsWith("http") ? profile.linkedin : `https://${profile.linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                  </a>
                )}
                {profile?.portfolio && (
                  <a
                    href={profile.portfolio.startsWith("http") ? profile.portfolio : `https://${profile.portfolio}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Globe className="h-3.5 w-3.5" /> Portfolio
                  </a>
                )}
              </div>
            </div>
          </div>
          <a
            href={`/api/cv/share/${token}/pdf`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download className="mr-2 h-4 w-4" /> Tải PDF
          </a>
        </div>
      </div>

      {/* CV Preview */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <CvPreview
          cv={cvInput}
          template={normalizeTemplate(cv.template)}
          accent={normalizeAccent(cv.accent)}
          font={normalizeFont(cv.font)}
        />
      </div>
    </div>
  );
}
