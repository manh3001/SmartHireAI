export function passwordStrength(pw: string): { ok: boolean; error?: string } {
  if (pw.length < 8) return { ok: false, error: "Mật khẩu tối thiểu 8 ký tự" };
  if (pw.length > 72) return { ok: false, error: "Mật khẩu tối đa 72 ký tự" };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, error: "Mật khẩu cần ít nhất một chữ cái" };
  if (!/[0-9]/.test(pw)) return { ok: false, error: "Mật khẩu cần ít nhất một chữ số" };
  return { ok: true };
}
