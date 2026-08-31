export type ProfileInput = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
};

export type ExperienceInput = {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type EducationInput = {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  gpa: string;
};

export type SkillInput = { name: string; level: string };

export type ProjectInput = {
  name: string;
  description: string;
  tech: string;
  link: string;
};

export type LanguageInput = { name: string; level: string };

export type CertificationInput = {
  name: string;
  issuer: string;
  date: string;
};

export type CvInput = {
  title: string;
  profile: ProfileInput;
  experiences: ExperienceInput[];
  educations: EducationInput[];
  skills: SkillInput[];
  projects: ProjectInput[];
  languages: LanguageInput[];
  certifications: CertificationInput[];
};
