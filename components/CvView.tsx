import type { CvInput } from "@/lib/cv/types";

export default function CvView({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  return (
    <div className="grid gap-4 text-sm text-foreground">
      <div>
        <p className="text-lg font-semibold text-foreground">{p.fullName || "(chưa có tên)"}</p>
        {p.headline && <p className="text-muted-foreground">{p.headline}</p>}
        <p className="text-xs text-muted-foreground">
          {[p.email, p.phone].filter(Boolean).join(" · ")}
        </p>
        {p.summary && <p className="mt-2 whitespace-pre-wrap">{p.summary}</p>}
      </div>

      {cv.experiences.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-foreground">Kinh nghiệm</h3>
          <div className="grid gap-2">
            {cv.experiences.map((e, i) => (
              <div key={i}>
                <p className="font-medium text-foreground">
                  {e.position} — {e.company}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                </p>
                {e.description && <p className="whitespace-pre-wrap">{e.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.educations.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-foreground">Học vấn</h3>
          <div className="grid gap-2">
            {cv.educations.map((e, i) => (
              <div key={i}>
                <p className="font-medium text-foreground">
                  {e.school}{e.major ? ` — ${e.major}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.skills.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-foreground">Kỹ năng</h3>
          <p>
            {cv.skills
              .map((s) => (s.level ? `${s.name} (${s.level})` : s.name))
              .join(", ")}
          </p>
        </section>
      )}

      {cv.projects.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-foreground">Dự án</h3>
          <div className="grid gap-2">
            {cv.projects.map((pr, i) => (
              <div key={i}>
                <p className="font-medium text-foreground">
                  {pr.name}{pr.tech ? ` · ${pr.tech}` : ""}
                </p>
                {pr.description && <p className="whitespace-pre-wrap">{pr.description}</p>}
                {pr.link && (
                  <a href={pr.link} className="text-xs text-primary hover:underline">
                    {pr.link}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
