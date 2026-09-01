export type InterviewData = {
  scheduledAt: Date;
  location: string;
  meetingLink: string;
  note: string;
};

export type ScheduleInterviewDeps = {
  findApplicationForRecruiter: (
    appId: string,
    recruiterId: string,
  ) => Promise<{ id: string; candidateId: string } | null>;
  upsertInterview: (
    applicationId: string,
    data: InterviewData,
  ) => Promise<void>;
  notifyCandidate: (
    candidateId: string,
    message: string,
    link: string,
  ) => Promise<void>;
};

export async function runScheduleInterview(
  params: {
    applicationId: string;
    recruiterId: string;
    recruiterName: string;
    data: InterviewData;
  },
  deps: ScheduleInterviewDeps,
): Promise<{ ok: boolean; error?: string }> {
  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  await deps.upsertInterview(params.applicationId, params.data);

  const dateStr = params.data.scheduledAt.toLocaleDateString("vi-VN");
  const timeStr = params.data.scheduledAt.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  try {
    await deps.notifyCandidate(
      app.candidateId,
      `Bạn có lịch phỏng vấn với ${params.recruiterName} vào ${dateStr} lúc ${timeStr}`,
      "/applications",
    );
  } catch {
    // thông báo lỗi không làm hỏng việc lưu lịch
  }

  return { ok: true };
}

export type CancelInterviewDeps = {
  findApplicationForRecruiter: (
    appId: string,
    recruiterId: string,
  ) => Promise<{ id: string; candidateId: string } | null>;
  deleteInterview: (applicationId: string) => Promise<void>;
  notifyCandidate: (
    candidateId: string,
    message: string,
    link: string,
  ) => Promise<void>;
};

export async function runCancelInterview(
  params: { applicationId: string; recruiterId: string; recruiterName: string },
  deps: CancelInterviewDeps,
): Promise<{ ok: boolean; error?: string }> {
  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  await deps.deleteInterview(params.applicationId);

  try {
    await deps.notifyCandidate(
      app.candidateId,
      `${params.recruiterName} đã huỷ lịch phỏng vấn`,
      "/applications",
    );
  } catch {
    // thông báo lỗi không làm hỏng việc huỷ
  }

  return { ok: true };
}
