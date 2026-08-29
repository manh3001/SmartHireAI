import type { ApplicationStatus } from "@/lib/applications/status";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";

const EMAIL_TRIGGER_STATUSES = ["INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const;
export type EmailTriggerStatus = (typeof EMAIL_TRIGGER_STATUSES)[number];

export function isEmailTriggerStatus(
  status: ApplicationStatus,
): status is EmailTriggerStatus {
  return (EMAIL_TRIGGER_STATUSES as readonly string[]).includes(status);
}

const MESSAGES: Record<
  EmailTriggerStatus,
  { subject: string; headline: string }
> = {
  INTERVIEW: {
    subject: "Bạn đã được mời phỏng vấn",
    headline: "Chúc mừng! Bạn đã được mời phỏng vấn.",
  },
  OFFER: {
    subject: "Bạn đã nhận được offer",
    headline: "Chúc mừng! Nhà tuyển dụng đã gửi offer cho bạn.",
  },
  HIRED: {
    subject: "Đơn ứng tuyển được chấp nhận",
    headline: "Chúc mừng! Đơn ứng tuyển của bạn đã được chấp nhận.",
  },
  REJECTED: {
    subject: "Thông báo về đơn ứng tuyển",
    headline: "Cảm ơn bạn đã ứng tuyển.",
  },
};

export function statusChangeEmail({
  candidateName,
  jobTitle,
  companyName,
  status,
}: {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  status: EmailTriggerStatus;
}): { subject: string; html: string } {
  const { subject, headline } = MESSAGES[status];
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#4f46e5">${headline}</h2>
  <p>Xin chào <strong>${candidateName}</strong>,</p>
  <p>Đơn ứng tuyển của bạn cho vị trí <strong>${jobTitle}</strong> tại <strong>${companyName}</strong> đã được cập nhật.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="color:#6b7280;font-size:12px">SmartHire — Nền tảng tuyển dụng AI</p>
</div>`.trim();
  return { subject, html };
}

export async function sendStatusChangeEmail(params: {
  to: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  status: EmailTriggerStatus;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  const { subject, html } = statusChangeEmail(params);
  await sendEmail({ to: params.to, subject, html });
}
