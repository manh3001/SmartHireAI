export function canDeleteUser(
  actorId: string,
  target: { id: string; role: string },
): { ok: boolean; reason?: string } {
  if (target.id === actorId) return { ok: false, reason: "Không thể tự xoá chính mình" };
  if (target.role === "ADMIN") return { ok: false, reason: "Không thể xoá tài khoản admin" };
  return { ok: true };
}
