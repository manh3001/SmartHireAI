import { formatSalary } from "@/lib/jobs/salary";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildJobAlertEmail(
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
  },
  appUrl: string,
): { subject: string; html: string } {
  const subject = "Việc làm mới khớp thông báo: " + job.title;
  const salary = formatSalary(job.salaryMin, job.salaryMax, false);
  const url = appUrl + "/jobs/" + job.id;

  const lines: string[] = [];
  lines.push(`<h2>${esc(job.title)}</h2>`);
  lines.push(`<p>${esc(job.company)}</p>`);
  if (job.location) lines.push(`<p>Địa điểm: ${esc(job.location)}</p>`);
  if (salary) lines.push(`<p>Mức lương: ${esc(salary)}</p>`);
  lines.push(`<p><a href="${url}">Xem chi tiết</a></p>`);
  lines.push(
    `<p style="color:#888;font-size:12px">Bạn nhận email này vì đã bật thông báo việc làm trên SmartHire.</p>`,
  );

  return { subject, html: lines.join("\n") };
}
