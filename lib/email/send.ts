// Gửi email qua Resend REST (không thêm dependency). Chưa cấu hình -> bỏ qua êm.
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: true, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html }),
    });
    if (!res.ok) console.warn(`[email] Resend trả về HTTP ${res.status}`);
    return { ok: res.ok };
  } catch (err) {
    console.warn("[email] Gửi email thất bại:", err);
    return { ok: false };
  }
}
