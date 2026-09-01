export const CACHE_TAGS = {
  jobs: "jobs",
  company: "company",
  applications: "applications",
  notifications: "notifications",
  cv: "cv",
  dashboard: "dashboard",
  candidateProfile: "candidateProfile",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
