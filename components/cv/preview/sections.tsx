import type { CvInput } from "@/lib/cv/types";
import { dateRange, eduSubLine } from "@/lib/cv/cv-format";

export function ExperienceList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.experiences.map((e, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{e.position} — {e.company}</div>
          {dateRange(e.startDate, e.endDate) && (
            <div className="text-[10px] text-slate-500">{dateRange(e.startDate, e.endDate)}</div>
          )}
          {e.description && <p>{e.description}</p>}
        </div>
      ))}
    </>
  );
}

export function EducationList({ cv }: { cv: CvInput }) {
  return (
    <>
      {cv.educations.map((e, i) => (
        <div key={i} className="mb-1.5">
          <div className="font-bold">{e.school}</div>
          <div className="text-[10px] text-slate-500">{eduSubLine(e.major, dateRange(e.startDate, e.endDate))}</div>
        </div>
      ))}
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
