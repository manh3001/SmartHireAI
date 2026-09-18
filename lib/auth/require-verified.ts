export const VERIFY_REQUIRED_MESSAGE =
  "Vui lòng xác minh email trước khi thực hiện thao tác này.";

export function isEmailVerified(
  user: { emailVerified: Date | null } | null,
): boolean {
  return !!user?.emailVerified;
}
