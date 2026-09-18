function wrap(title: string, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#4f46e5">${title}</h2>
    ${body}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
  </div>`;
}

export function verifyEmailHtml(link: string): string {
  return wrap(
    "Xác minh email",
    `<p>Nhấn nút dưới để xác minh địa chỉ email của bạn:</p>
     <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Xác minh email</a></p>
     <p style="color:#64748b;font-size:13px">Hoặc mở liên kết: <br>${link}</p>`,
  );
}

export function resetPasswordHtml(link: string): string {
  return wrap(
    "Đặt lại mật khẩu",
    `<p>Nhấn nút dưới để đặt lại mật khẩu (liên kết hết hạn sau 1 giờ):</p>
     <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Đặt lại mật khẩu</a></p>
     <p style="color:#64748b;font-size:13px">Hoặc mở liên kết: <br>${link}</p>`,
  );
}
