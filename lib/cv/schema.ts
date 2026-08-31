import { z } from "zod";
import type { CvInput } from "./types";

const profileSchema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ tên"),
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  linkedin: z.string(),
  github: z.string(),
  portfolio: z.string(),
  summary: z.string(),
});

const experienceSchema = z.object({
  company: z.string().min(1, "Thiếu tên công ty"),
  position: z.string().min(1, "Thiếu vị trí"),
  startDate: z.string(),
  endDate: z.string(),
  description: z.string(),
});

const educationSchema = z.object({
  school: z.string().min(1, "Thiếu tên trường"),
  degree: z.string(),
  major: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  gpa: z.string(),
});

const skillSchema = z.object({
  name: z.string().min(1, "Thiếu tên kỹ năng"),
  level: z.string(),
});

const projectSchema = z.object({
  name: z.string().min(1, "Thiếu tên dự án"),
  description: z.string(),
  tech: z.string(),
  link: z.string(),
});

const languageSchema = z.object({
  name: z.string().min(1, "Thiếu tên ngôn ngữ"),
  level: z.string(),
});

const certificationSchema = z.object({
  name: z.string().min(1, "Thiếu tên chứng chỉ"),
  issuer: z.string(),
  date: z.string(),
});

export const cvSchema = z.object({
  title: z.string(),
  profile: profileSchema,
  experiences: z.array(experienceSchema),
  educations: z.array(educationSchema),
  skills: z.array(skillSchema),
  projects: z.array(projectSchema),
  languages: z.array(languageSchema),
  certifications: z.array(certificationSchema),
});

export function emptyCv(): CvInput {
  return {
    title: "CV chưa đặt tên",
    profile: {
      fullName: "", headline: "", email: "", phone: "",
      location: "", linkedin: "", github: "", portfolio: "",
      summary: "",
    },
    experiences: [],
    educations: [],
    skills: [],
    projects: [],
    languages: [],
    certifications: [],
  };
}
