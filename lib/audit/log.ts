export const AUDIT_ACTIONS = {
  loginSuccess: "login.success",
  loginFailure: "login.failure",
  register: "register",
  emailVerify: "email.verify",
  passwordResetRequest: "password.reset.request",
  passwordReset: "password.reset",
  roleChange: "role.change",
  userDelete: "user.delete",
  sessionRevokeAll: "session.revoke_all",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditEntry = {
  userId?: string | null;
  action: AuditAction;
  targetId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RecordAuditDeps = { save: (e: AuditEntry) => Promise<void> };

export async function recordAudit(entry: AuditEntry, deps: RecordAuditDeps): Promise<void> {
  try {
    await deps.save(entry);
  } catch (e) {
    console.warn("[audit] ghi log that bai:", e);
  }
}
