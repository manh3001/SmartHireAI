export const LOGO_MAX_BYTES = 500 * 1024;
export const LOGO_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMime = (typeof LOGO_MIME)[number];

export function isLogoMime(v: string): v is LogoMime {
  return (LOGO_MIME as readonly string[]).includes(v);
}

export function validateLogo(
  file: { type: string; size: number },
): { ok: true } | { ok: false; error: string } {
  if (!isLogoMime(file.type)) {
    return { ok: false, error: "Chỉ hỗ trợ PNG, JPEG, WebP" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Ảnh quá lớn (tối đa 500KB)" };
  }
  return { ok: true };
}
