import type {
  CvInput,
  EducationInput,
  ExperienceInput,
  ProjectInput,
  SkillInput,
} from "./types";

const t = (s: string) => s.trim();

function notEmpty(values: string[]): boolean {
  return values.some((v) => t(v).length > 0);
}

export function normalizeCv(input: CvInput): CvInput {
  return {
    title: t(input.title),
    profile: {
      fullName: t(input.profile.fullName),
      headline: t(input.profile.headline),
      email: t(input.profile.email),
      phone: t(input.profile.phone),
      summary: t(input.profile.summary),
    },
    experiences: input.experiences
      .map(
        (e): ExperienceInput => ({
          company: t(e.company),
          position: t(e.position),
          startDate: t(e.startDate),
          endDate: t(e.endDate),
          description: t(e.description),
        }),
      )
      .filter((e) =>
        notEmpty([e.company, e.position, e.startDate, e.endDate, e.description]),
      ),
    educations: input.educations
      .map(
        (e): EducationInput => ({
          school: t(e.school),
          major: t(e.major),
          startDate: t(e.startDate),
          endDate: t(e.endDate),
        }),
      )
      .filter((e) => notEmpty([e.school, e.major, e.startDate, e.endDate])),
    skills: input.skills
      .map((s): SkillInput => ({ name: t(s.name), level: t(s.level) }))
      .filter((s) => notEmpty([s.name, s.level])),
    projects: input.projects
      .map(
        (p): ProjectInput => ({
          name: t(p.name),
          description: t(p.description),
          tech: t(p.tech),
          link: t(p.link),
        }),
      )
      .filter((p) => notEmpty([p.name, p.description, p.tech, p.link])),
  };
}
