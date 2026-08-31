export type AddNoteDeps = {
  findApplicationForRecruiter: (
    appId: string,
    recruiterId: string,
  ) => Promise<{ id: string } | null>;
  createNote: (data: {
    applicationId: string;
    recruiterId: string;
    content: string;
  }) => Promise<void>;
};

export async function runAddNote(
  params: { applicationId: string; recruiterId: string; content: string },
  deps: AddNoteDeps,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = params.content.trim();
  if (!trimmed) return { ok: false, error: "Ghi chú không được để trống" };
  if (trimmed.length > 2000)
    return { ok: false, error: "Ghi chú không được vượt quá 2000 ký tự" };

  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không có quyền thêm ghi chú" };

  await deps.createNote({
    applicationId: params.applicationId,
    recruiterId: params.recruiterId,
    content: trimmed,
  });
  return { ok: true };
}
