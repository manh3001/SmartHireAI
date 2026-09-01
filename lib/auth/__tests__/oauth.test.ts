import { describe, it, expect, vi } from "vitest";
import { resolveOAuthUser } from "../oauth";

describe("resolveOAuthUser", () => {
  it("lien ket: tra ve user co san, khong tao moi", async () => {
    const findByEmail = vi.fn().mockResolvedValue({ id: "u0", role: "RECRUITER" });
    const createUser = vi.fn();
    const r = await resolveOAuthUser("a@b.com", "Manh", { findByEmail, createUser });
    expect(r).toEqual({ id: "u0", role: "RECRUITER" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("tao moi voi role CANDIDATE khi email chua ton tai", async () => {
    const findByEmail = vi.fn().mockResolvedValue(null);
    const createUser = vi.fn().mockResolvedValue({ id: "u1", role: "CANDIDATE" });
    const r = await resolveOAuthUser("new@b.com", "Tan", { findByEmail, createUser });
    expect(r).toEqual({ id: "u1", role: "CANDIDATE" });
    expect(createUser).toHaveBeenCalledWith("new@b.com", "Tan");
  });
});
