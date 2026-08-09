import type { CvInput } from "@/lib/cv/types";
import type { AccentDef } from "@/lib/cv/accents";
import { ExperienceList, EducationList, ProjectList } from "./sections";

function Title({ color, children }: { color: string; children: React.ReactNode }) {
  return <h2 className="mt-3 mb-1.5 text-[13px] font-bold" style={{ color }}>{children}</h2>;
}

export default function SidebarPreview({ cv, accent }: { cv: CvInput; accent: AccentDef }) {
  const p = cv.profile;
  return (
    <div className="flex text-[11px] leading-relaxed text-slate-900">
      <div className="w-1/3 p-6" style={{ backgroundColor: accent.soft }}>
        <div className="text-[18px] font-bold">{p.fullName || "Chưa có tên"}</div>
        {p.headline && <div className="mb-2 text-[11px] text-slate-500">{p.headline}</div>}
        <h3 className="mt-3 mb-1 text-[11px] font-bold" style={{ color: accent.hex }}>Liên hệ</h3>
        {p.email && <div className="text-[10px] text-slate-600">{p.email}</div>}
        {p.phone && <div className="text-[10px] text-slate-600">{p.phone}</div>}
        {cv.skills.length > 0 && (
          <>
            <h3 className="mt-3 mb-1 text-[11px] font-bold" style={{ color: accent.hex }}>Kỹ năng</h3>
            {cv.skills.map((sk, i) => (
              <div key={i} className="text-[10px] text-slate-600">• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>
            ))}
          </>
        )}
      </div>
      <div className="w-2/3 p-6">
        {p.summary && <p className="mb-1">{p.summary}</p>}
        {cv.experiences.length > 0 && (<section><Title color={accent.hex}>Kinh nghiệm làm việc</Title><ExperienceList cv={cv} /></section>)}
        {cv.educations.length > 0 && (<section><Title color={accent.hex}>Học vấn</Title><EducationList cv={cv} /></section>)}
        {cv.projects.length > 0 && (<section><Title color={accent.hex}>Dự án</Title><ProjectList cv={cv} /></section>)}
      </div>
    </div>
  );
}
