export type RateScope = "login" | "register" | "ai" | "mutation" | "passwordReset";

export const RATE_LIMITS: Record<
  RateScope,
  { max: number; windowMs: number; failClosed?: boolean }
> = {
  login: { max: 5, windowMs: 15 * 60_000, failClosed: true }, // 5 / 15 phút
  register: { max: 5, windowMs: 60 * 60_000, failClosed: true }, // 5 / giờ
  passwordReset: { max: 5, windowMs: 60 * 60_000, failClosed: true }, // 5 / giờ
  ai: { max: 20, windowMs: 60 * 60_000 }, // 20 / giờ
  mutation: { max: 30, windowMs: 60_000 }, // 30 / phút
};
