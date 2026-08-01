export const SALARY_FILTER_STEPS = [10, 15, 20, 25, 30, 40, 50] as const;

const MILLION = 1_000_000;

// VND -> chuỗi triệu, bỏ ".0" thừa, giữ tối đa 1 chữ số thập phân.
function toMillions(vnd: number): string {
  const m = Math.round((vnd / MILLION) * 10) / 10;
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}

export function formatSalary(
  min: number | null,
  max: number | null,
  negotiable: boolean,
): string | null {
  if (min != null && max != null) return `${toMillions(min)} – ${toMillions(max)} triệu`;
  if (min != null) return `Từ ${toMillions(min)} triệu`;
  if (max != null) return `Tới ${toMillions(max)} triệu`;
  if (negotiable) return "Thỏa thuận";
  return null;
}

// Chuỗi số triệu người dùng nhập -> VND (int). Rỗng/không hợp lệ/âm -> null.
export function parseSalaryInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * MILLION);
}

// Mảnh Prisma where: job có thể trả >= minMillions triệu.
export function salaryWhere(minMillions: number | null): Record<string, unknown> {
  if (minMillions == null) return {};
  const vnd = minMillions * MILLION;
  return {
    OR: [
      { salaryMax: { gte: vnd } },
      { AND: [{ salaryMax: null }, { salaryMin: { gte: vnd } }] },
    ],
  };
}
