import type { CvInput } from "@/lib/cv/types";
import { contactLine, linksLine } from "@/lib/cv/cv-format";
import { ExperienceList, EducationList, ProjectList, LanguageList, CertificationList } from "./sections";

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 border-b border-slate-300 pb-1 text-[13px] font-bold text-slate-800">{children}</h2>;
}

export default function ClassicPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone, p.location);
  const links = linksLine(p.linkedin, p.github, p.portfolio);
  return (
    <div className="p-8 text-[11px] leading-relaxed text-slate-900">
      <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
      {p.headline && <div className="text-[12px] text-slate-500">{p.headline}</div>}
      {contact && <div className="text-[10px] text-slate-500">{contact}</div>}
      {links && <div className="mb-2 text-[10px] text-slate-400">{links}</div>}
      {p.summary && <p className="mb-1">{p.summary}</p>}
      {cv.experiences.length > 0 && (<section><Title>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
      {cv.educations.length > 0 && (<section><Title>Học vấn</Title><EducationList cv={cv} /></section>)}
      {cv.skills.length > 0 && (
        <section><Title>Kỹ năng</Title>
          {cv.skills.map((sk, i) => (<div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>))}
        </section>
      )}
      {cv.languages.length > 0 && (<section><Title>Ngoại ngữ</Title><LanguageList cv={cv} /></section>)}
      {cv.certifications.length > 0 && (<section><Title>Chứng chỉ</Title><CertificationList cv={cv} /></section>)}
      {cv.projects.length > 0 && (<section><Title>Dự án</Title><ProjectList cv={cv} /></section>)}
    </div>
  );
}
