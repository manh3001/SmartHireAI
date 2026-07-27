import { registerSchema, type RegisterInput } from "./validation";

export type RegisterDeps = {
  findByEmail: (email: string) => Promise<{ id: string } | null>;
  create: (data: {
    email: string;
    name: string;
    passwordHash: string;
  }) => Promise<{ id: string }>;
  hash: (p: string) => Promise<string>;
};

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function registerUser(
  input: RegisterInput,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { email, name, password } = parsed.data;

  const existing = await deps.findByEmail(email);
  if (existing) return { ok: false, error: "Email đã được đăng ký" };

  const passwordHash = await deps.hash(password);
  const user = await deps.create({ email, name, passwordHash });
  return { ok: true, userId: user.id };
}
