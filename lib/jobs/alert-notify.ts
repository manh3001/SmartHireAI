import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import { matchesAlert, type AlertCriteria, type MatchableJob } from "./alerts";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import type { JobCategory } from "./job-categories";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { buildJobAlertEmail } from "@/lib/email/job-alert-email";

export type NotifyJob = MatchableJob & { id: string; userId: string };

// Khi tạo tin công khai mới: tìm mọi JobAlert khớp, tạo thông báo in-app cho
// các ứng viên (khử trùng theo user, loại người đăng); gửi thêm email cho ai
// bật email. Nuốt lỗi để không làm hỏng luồng đăng tin.
export async function notifyMatchingAlerts(job: NotifyJob): Promise<void> {
  try {
    const alerts = await prisma.jobAlert.findMany({
      select: {
        userId: true,
        term: true,
        category: true,
        employmentType: true,
        experienceLevel: true,
        salaryMillions: true,
        emailEnabled: true,
      },
    });

    const inAppRecipients = new Set<string>();
    const emailRecipients = new Set<string>();
    for (const a of alerts) {
      if (a.userId === job.userId) continue;
      const criteria: AlertCriteria = {
        term: a.term ?? undefined,
        category: (a.category as JobCategory | null) ?? undefined,
        employmentType: (a.employmentType as EmploymentType | null) ?? undefined,
        experienceLevel: (a.experienceLevel as ExperienceLevel | null) ?? undefined,
        salaryMillions: a.salaryMillions,
      };
      if (!matchesAlert(job, criteria)) continue;
      inAppRecipients.add(a.userId);
      if (a.emailEnabled) emailRecipients.add(a.userId);
    }

    const message = `Tin mới khớp thông báo của bạn: ${job.title} — ${job.company}`;
    const link = `/jobs/${job.id}`;
    await Promise.all(
      [...inAppRecipients].map((userId) => createNotification(userId, { message, link })),
    );

    if (isEmailConfigured() && emailRecipients.size > 0) {
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const users = await prisma.user.findMany({
        where: { id: { in: [...emailRecipients] } },
        select: { email: true },
      });
      const mail = buildJobAlertEmail(job, appUrl);
      await Promise.all(
        users.map((u) => sendEmail({ to: u.email, subject: mail.subject, html: mail.html })),
      );
    }
  } catch {
    // Bỏ qua: thông báo/email lỗi không được cản trở việc đăng tin.
  }
}
