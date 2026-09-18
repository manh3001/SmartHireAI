export type TokenVersionCheck = "valid" | "revoked" | "deleted";

export function checkTokenVersion(input: {
  tokenVersion: number | undefined;
  dbVersion: number | null;
}): TokenVersionCheck {
  if (input.dbVersion === null) return "deleted";
  if (typeof input.tokenVersion === "number" && input.tokenVersion !== input.dbVersion) {
    return "revoked";
  }
  return "valid";
}
