import type { CvInput } from "@/lib/cv/types";
import type { AccentDef } from "@/lib/cv/accents";
import { contactLine, linksLine } from "@/lib/cv/cv-format";
import { ExperienceList, EducationList, ProjectList, LanguageList, CertificationList } from "./sections";

function Title({ color, children }: { color: string; children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 text-[13px] font-bold" style={{ color }}>{children}</h2>;
}

export default function ModernPreview({ cv, accent }: { cv: CvInput; accent: AccentDef }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone, p.location);
  const links = linksLine(p.linkedin, p.github, p.portfolio);
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      <div className="px-8 py-6 text-white" style={{ backgroundColor: accent.hex }}>
        <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="text-[12px]" style={{ color: accent.onDark }}>{p.headline}</div>}
        {contact && <div className="mt-1 text-[10px]" style={{ color: accent.onDark }}>{contact}</div>}
        {links && <div className="text-[10px] opacity-80" style={{ color: accent.onDark }}>{links}</div>}
      </div>
      <div className="p-8">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title color={accent.hex}>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title color={accent.hex}>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.skills.length > 0 && (
          <section><Title color={accent.hex}>Kỹ năng</Title>
            {cv.skills.map((sk, i) => (<div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>))}
          </section>
        )}
        {cv.languages.length > 0 && (<section><Title color={accent.hex}>Ngoại ngữ</Title><LanguageList cv={cv} /></section>)}
        {cv.certifications.length > 0 && (<section><Title color={accent.hex}>Chứng chỉ</Title><CertificationList cv={cv} /></section>)}
        {cv.projects.length > 0 && (<section><Title color={accent.hex}>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
