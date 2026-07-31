export function isThreadParticipant(
  userId: string,
  thread: { candidateId: string; recruiterId: string },
): boolean {
  return userId === thread.candidateId || userId === thread.recruiterId;
}
