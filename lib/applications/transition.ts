import { canTransition, type ApplicationStatus } from "./status";

export type ChangeStatusParams = {
  applicationId: string;
  recruiterId: string;
  toStatus: ApplicationStatus;
  note: string;
};

export type ChangeStatusDeps = {
  findApplicationForRecruiter: (
    applicationId: string,
    recruiterId: string,
  ) => Promise<{ id: string; status: ApplicationStatus } | null>;
  applyStatusChange: (data: {
    applicationId: string;
    fromStatus: ApplicationStatus;
    toStatus: ApplicationStatus;
    note: string;
  }) => Promise<void>;
};

export type ChangeStatusOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function runChangeStatus(
  params: ChangeStatusParams,
  deps: ChangeStatusDeps,
): Promise<ChangeStatusOutcome> {
  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  if (!canTransition(app.status, params.toStatus)) {
    return { ok: false, error: "Không thể chuyển sang trạng thái này" };
  }

  await deps.applyStatusChange({
    applicationId: app.id,
    fromStatus: app.status,
    toStatus: params.toStatus,
    note: params.note,
  });
  return { ok: true };
}
