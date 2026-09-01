export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
};

export type CredentialsUser = AuthedUser & { passwordHash: string | null };

export type ResolveCredentialsDeps = {
  findByEmail: (email: string) => Promise<CredentialsUser | null>;
  verify: (plain: string, hash: string) => Promise<boolean>;
};

export async function resolveCredentials(
  email: string,
  password: string,
  deps: ResolveCredentialsDeps,
): Promise<AuthedUser | null> {
  const user = await deps.findByEmail(email);
  if (!user) return null;
  if (!user.passwordHash) return null; // tài khoản chỉ-Google, không cho đăng nhập mật khẩu
  const ok = await deps.verify(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
