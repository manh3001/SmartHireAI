export type TwoFactorOutcome = "ok" | "required" | "invalid";

export async function resolveTwoFactor(
  input: { totpEnabled: boolean; code: string | undefined },
  deps: {
    checkTotp: (code: string) => boolean;
    consumeBackup: (code: string) => Promise<boolean>;
  },
): Promise<TwoFactorOutcome> {
  if (!input.totpEnabled) return "ok";
  const code = (input.code ?? "").trim();
  if (!code) return "required";
  if (deps.checkTotp(code)) return "ok";
  if (await deps.consumeBackup(code)) return "ok";
  return "invalid";
}
