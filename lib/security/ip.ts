export function isValidIp(s: string): boolean {
  if (!s) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    return s.split(".").every((o) => Number(o) <= 255);
  }
  // IPv6 (kiểm tra cơ bản: chỉ hex + dấu ':' và có ít nhất một ':')
  return /^[0-9a-fA-F:]+$/.test(s) && s.includes(":");
}

// Lấy IP client. Mô hình tin cậy: header chuyển tiếp (x-forwarded-for) chỉ đáng
// tin khi có proxy làm sạch nó (Vercel ghi đè giá trị client gửi -> đáng tin).
// Deploy tự host KHÔNG có proxy làm sạch: đặt CLIENT_IP_HEADER sang header mà chỉ
// proxy của bạn đặt.
export function getClientIp(req: Request | undefined): string {
  if (!req) return "unknown";
  const headerName = process.env.CLIENT_IP_HEADER || "x-forwarded-for";
  const raw = req.headers.get(headerName);
  if (raw) {
    const first = raw.split(",")[0].trim();
    if (isValidIp(first)) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real && isValidIp(real.trim())) return real.trim();
  return "unknown";
}
