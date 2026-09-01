export type ProfileInput = {
  username: string;
  bio: string;
  github: string;
  linkedin: string;
  twitter: string;
  website: string;
};

export type UpsertProfileDeps = {
  findByUsername: (username: string) => Promise<{ userId: string } | null>;
  upsertProfile: (userId: string, data: ProfileInput) => Promise<unknown>;
};

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export async function runUpsertProfile(
  userId: string,
  data: ProfileInput,
  deps: UpsertProfileDeps,
): Promise<{ ok: boolean; error?: string }> {
  const username = data.username.trim().toLowerCase();

  if (username.length < 3 || username.length > 30) {
    return { ok: false, error: "Username phải từ 3 đến 30 ký tự" };
  }
  if (!USERNAME_REGEX.test(username) || username.includes("--")) {
    return {
      ok: false,
      error: "Username chỉ được chứa chữ thường, số, và dấu gạch ngang; không bắt đầu/kết thúc bằng gạch ngang",
    };
  }
  if (data.bio.length > 300) {
    return { ok: false, error: "Giới thiệu bản thân tối đa 300 ký tự" };
  }

  const existing = await deps.findByUsername(username);
  if (existing && existing.userId !== userId) {
    return { ok: false, error: "Username này đã được sử dụng" };
  }

  await deps.upsertProfile(userId, { ...data, username });
  return { ok: true };
}
