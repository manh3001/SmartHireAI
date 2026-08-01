export type PromoteDeps = {
  findByEmail: (email: string) => Promise<{ id: string; role: string } | null>;
  setRole: (id: string) => Promise<void>;
};

export type PromoteResult =
  | { ok: true; alreadyAdmin: boolean }
  | { ok: false; error: string };

export async function promoteToAdmin(email: string, deps: PromoteDeps): Promise<PromoteResult> {
  const e = email.trim();
  if (e === "") return { ok: false, error: "Thiếu email" };
  const user = await deps.findByEmail(e);
  if (!user) return { ok: false, error: `Không tìm thấy user với email ${e}` };
  if (user.role === "ADMIN") return { ok: true, alreadyAdmin: true };
  await deps.setRole(user.id);
  return { ok: true, alreadyAdmin: false };
}
