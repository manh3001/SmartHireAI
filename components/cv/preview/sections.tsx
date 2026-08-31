import type { CvInput } from "@/lib/cv/types";
import { dateRange, eduSubLine } from "@/lib/cv/cv-format";

export function ExperienceList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.experiences.map((e, i) => {
        const range = dateRange(e.startDate, e.endDate);
        return (
          <div key={i} className="mb-1.5">
            <div className="font-bold">{e.position} — {e.company}</div>
            {range && <div className="text-[10px] text-slate-500">{range}</div>}
            {e.description && <p>{e.description}</p>}
          </div>
        );
      })}
    </>
  );
}

export function EducationList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.educations.map((e, i) => {
        const sub = eduSubLine(e.degree ?? "", e.major, dateRange(e.startDate, e.endDate), e.gpa);
        return (
          <div key={i} className="mb-1.5">
            <div className="font-bold">{e.school}</div>
            {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
          </div>
        );
      })}
    </>
  );
}

export function ProjectList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.projects.map((pr, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{pr.name}</div>
          {pr.tech && <div className="text-[10px] text-slate-500">{pr.tech}</div>}
          {pr.description && <p>{pr.description}</p>}
          {pr.link && <div className="text-[10px] text-slate-500">{pr.link}</div>}
        </div>
      ))}
    </>
  );
}

export function LanguageList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.languages.map((l, i) => (
        <div key={i}>• {l.name}{l.level ? ` (${l.level})` : ""}</div>
      ))}
    </>
  );
}

export function CertificationList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.certifications.map((c, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{c.name}</div>
          {(c.issuer || c.date) && (
            <div className="text-[10px] text-slate-500">
              {[c.issuer, c.date].filter(Boolean).join(" • ")}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
