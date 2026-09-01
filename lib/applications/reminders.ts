export type DueInterview = {
  applicationId: string;
  candidateId: string;
  recruiterId: string;
  jobTitle: string;
  scheduledAt: Date;
};

export function selectDueReminders(
  interviews: DueInterview[],
  now: Date,
): DueInterview[] {
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return interviews.filter(
    (iv) => iv.scheduledAt >= now && iv.scheduledAt <= limit,
  );
}
