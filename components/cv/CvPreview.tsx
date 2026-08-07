import type { CvInput } from "@/lib/cv/types";
import { dateRange, contactLine, eduSubLine } from "@/lib/cv/cv-format";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 mb-1.5 border-b border-slate-300 pb-1 text-[13px] font-bold text-slate-800">
      {children}
    </h2>
  );
}

// Bản xem trước dạng "tờ giấy" CV — mô phỏng layout của lib/pdf/CvDocument.tsx.
// Nền giấy cố ý dùng bg-white/slate (không token) để giống trang in.
export default function CvPreview({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  const contact = contactLine(p.email, p.phone);
  return (
    <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-slate-200 bg-white p-8 text-[11px] leading-relaxed text-slate-900 shadow-sm">
      <div className="text-[22px] font-bold">{p.fullName || "Chưa có tên"}</div>
      {p.headline && <div className="text-[12px] text-slate-500">{p.headline}</div>}
      {contact && <div className="mb-2 text-[10px] text-slate-500">{contact}</div>}
      {p.summary && <p className="mb-1">{p.summary}</p>}

      {cv.experiences.length > 0 && (
        <section>
          <SectionTitle>Kinh nghiệm làm việc</SectionTitle>
          {cv.experiences.map((e, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-bold">{e.position} — {e.company}</div>
              {dateRange(e.startDate, e.endDate) && (
                <div className="text-[10px] text-slate-500">{dateRange(e.startDate, e.endDate)}</div>
              )}
              {e.description && <p>{e.description}</p>}
            </div>
          ))}
        </section>
      )}

      {cv.educations.length > 0 && (
        <section>
          <SectionTitle>Học vấn</SectionTitle>
          {cv.educations.map((e, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-bold">{e.school}</div>
              <div className="text-[10px] text-slate-500">
                {eduSubLine(e.major, dateRange(e.startDate, e.endDate))}
              </div>
            </div>
          ))}
        </section>
      )}

      {cv.skills.length > 0 && (
        <section>
          <SectionTitle>Kỹ năng</SectionTitle>
          {cv.skills.map((sk, i) => (
            <div key={i}>• {sk.name}{sk.level ? ` (${sk.level})` : ""}</div>
          ))}
        </section>
      )}

      {cv.projects.length > 0 && (
        <section>
          <SectionTitle>Dự án</SectionTitle>
          {cv.projects.map((pr, i) => (
            <div key={i} className="mb-1.5">
              <div className="font-bold">{pr.name}</div>
              {pr.tech && <div className="text-[10px] text-slate-500">{pr.tech}</div>}
              {pr.description && <p>{pr.description}</p>}
              {pr.link && <div className="text-[10px] text-slate-500">{pr.link}</div>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
