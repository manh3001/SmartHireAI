import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import { matchesAlert, type AlertCriteria, type MatchableJob } from "./alerts";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import type { JobCategory } from "./job-categories";

export type NotifyJob = MatchableJob & { id: string; userId: string };

// Khi tạo tin công khai mới: tìm mọi JobAlert khớp, tạo thông báo cho các
// ứng viên (khử trùng theo user, loại người đăng tin). Nuốt lỗi để không làm
// hỏng luồng đăng tin.
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
      },
    });

    const recipients = new Set<string>();
    for (const a of alerts) {
      if (a.userId === job.userId) continue;
      if (recipients.has(a.userId)) continue;
      const criteria: AlertCriteria = {
        term: a.term ?? undefined,
        category: (a.category as JobCategory | null) ?? undefined,
        employmentType: (a.employmentType as EmploymentType | null) ?? undefined,
        experienceLevel: (a.experienceLevel as ExperienceLevel | null) ?? undefined,
        salaryMillions: a.salaryMillions,
      };
      if (matchesAlert(job, criteria)) recipients.add(a.userId);
    }

    const message = `Tin mới khớp thông báo của bạn: ${job.title} — ${job.company}`;
    const link = `/jobs/${job.id}`;
    await Promise.all(
      [...recipients].map((userId) => createNotification(userId, { message, link })),
    );
  } catch {
    // Bỏ qua: thông báo lỗi không được cản trở việc đăng tin.
  }
}
