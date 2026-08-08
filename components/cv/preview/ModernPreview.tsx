import type { CvInput } from "@/lib/cv/types";
import { contactLine } from "@/lib/cv/cv-format";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 mb-1.5 text-[13px] font-bold text-indigo-600">{children}</h2>;
}

export default function ModernPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <div className="text-[11px] leading-relaxed text-slate-900">
      <div className="bg-indigo-600 px-8 py-6 text-white">
        <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="text-[12px] text-indigo-100">{p.headline}</div>}
        {contact && <div className="mt-1 text-[10px] text-indigo-100">{contact}</div>}
      </div>
      <div className="p-8">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.skills.length > 0 && (
          <section><Title>Kỹ năng</Title>
            {cv.skills.map((sk, i) => (<div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>))}
          </section>
        )}
        {cv.projects.length > 0 && (<section><Title>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
