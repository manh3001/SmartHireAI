import type { CvInput } from "@/lib/cv/types";

export type ApplyParams = {
  jobId: string;
  candidateId: string;
  cvId: string;
  coverLetter: string;
};

export type CreateApplicationData = {
  jobId: string;
  candidateId: string;
  cvId: string;
  cvSnapshot: CvInput;
  coverLetter: string;
};

export type ApplyDeps = {
  findPublicJob: (jobId: string) => Promise<{ id: string } | null>;
  findExistingApplication: (
    jobId: string,
    candidateId: string,
  ) => Promise<{ id: string } | null>;
  findCandidateCv: (
    cvId: string,
    candidateId: string,
  ) => Promise<CvInput | null>;
  createApplication: (data: CreateApplicationData) => Promise<{ id: string }>;
};

export type ApplyOutcome =
  | { ok: true; applicationId: string }
  | { ok: false; error: string };

export async function runApply(
  params: ApplyParams,
  deps: ApplyDeps,
): Promise<ApplyOutcome> {
  const job = await deps.findPublicJob(params.jobId);
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const existing = await deps.findExistingApplication(
    params.jobId,
    params.candidateId,
  );
  if (existing) return { ok: false, error: "Bạn đã ứng tuyển tin này" };

  const cv = await deps.findCandidateCv(params.cvId, params.candidateId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  const created = await deps.createApplication({
    jobId: params.jobId,
    candidateId: params.candidateId,
    cvId: params.cvId,
    cvSnapshot: cv,
    coverLetter: params.coverLetter,
  });
  return { ok: true, applicationId: created.id };
}
