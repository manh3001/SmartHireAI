import { employmentTypeToSchema } from "./job-seo";
import type { EmploymentType } from "@/lib/jobs/job-fields";

export type JobPostingInput = {
  title: string;
  company: string;
  rawText: string;
  location: string;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: Date;
};

export function buildJobPostingJsonLd(
  job: JobPostingInput,
  url: string,
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title || "Tin tuyển dụng",
    description: job.rawText,
    datePosted: job.createdAt.toISOString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company || "Nhà tuyển dụng",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location || "Việt Nam",
        addressCountry: "VN",
      },
    },
    url,
    directApply: true,
  };
  if (job.employmentType) ld.employmentType = employmentTypeToSchema(job.employmentType);
  if (job.salaryMin || job.salaryMax) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "VND",
      value: {
        "@type": "QuantitativeValue",
        ...(job.salaryMin ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax ? { maxValue: job.salaryMax } : {}),
        unitText: "MONTH",
      },
    };
  }
  return ld;
}
