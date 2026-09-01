export type UpcomingRow = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  counterpartName: string;
  scheduledAt: Date;
  location: string;
  meetingLink: string;
};

export type UpcomingDeps = {
  listForCandidate: (candidateId: string, now: Date) => Promise<UpcomingRow[]>;
  listForRecruiter: (recruiterId: string, now: Date) => Promise<UpcomingRow[]>;
};

export async function getUpcomingInterviews(
  userId: string,
  role: "CANDIDATE" | "RECRUITER",
  now: Date,
  deps: UpcomingDeps,
): Promise<UpcomingRow[]> {
  const rows =
    role === "RECRUITER"
      ? await deps.listForRecruiter(userId, now)
      : await deps.listForCandidate(userId, now);
  return [...rows].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}
