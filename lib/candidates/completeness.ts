export type CompletenessInput = {
  hasCV: boolean;
  bio: string;
  github: string;
  linkedin: string;
  website: string;
};

export type CompletenessItem = { key: string; label: string; href: string };
export type CompletenessResult = { percent: number; missing: CompletenessItem[] };

const ITEMS: { key: keyof CompletenessInput; label: string; href: string }[] = [
  { key: "hasCV", label: "Tạo CV", href: "/cv" },
  { key: "bio", label: "Viết giới thiệu bản thân", href: "/settings/profile" },
  { key: "github", label: "Thêm GitHub", href: "/settings/profile" },
  { key: "linkedin", label: "Thêm LinkedIn", href: "/settings/profile" },
  { key: "website", label: "Thêm website", href: "/settings/profile" },
];

function isFilled(input: CompletenessInput, key: keyof CompletenessInput): boolean {
  const v = input[key];
  return typeof v === "boolean" ? v : v.trim().length > 0;
}

export function profileCompleteness(input: CompletenessInput): CompletenessResult {
  const filledCount = ITEMS.filter((it) => isFilled(input, it.key)).length;
  const missing = ITEMS.filter((it) => !isFilled(input, it.key)).map(
    ({ key, label, href }) => ({ key, label, href }),
  );
  const percent = Math.round((filledCount / ITEMS.length) * 100);
  return { percent, missing };
}
