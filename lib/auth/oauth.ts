export type OAuthRole = "CANDIDATE" | "RECRUITER" | "ADMIN";
export type OAuthUser = { id: string; role: OAuthRole };

export type ResolveOAuthDeps = {
  findByEmail: (email: string) => Promise<OAuthUser | null>;
  createUser: (email: string, name: string) => Promise<OAuthUser>;
};

export async function resolveOAuthUser(
  email: string,
  name: string,
  deps: ResolveOAuthDeps,
): Promise<OAuthUser> {
  const existing = await deps.findByEmail(email);
  if (existing) return existing; // liên kết theo email
  return deps.createUser(email, name);
}
