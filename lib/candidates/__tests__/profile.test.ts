import { describe, it, expect, vi } from "vitest";
import { runUpsertProfile } from "../profile-logic";
import type { UpsertProfileDeps } from "../profile-logic";

const validInput = {
  username: "nguyena",
  bio: "Hello",
  github: "github.com/nguyena",
  linkedin: "",
  twitter: "",
  website: "",
};

function makeDeps(overrides?: Partial<UpsertProfileDeps>): UpsertProfileDeps {
  return {
    findByUsername: vi.fn().mockResolvedValue(null),
    upsertProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("runUpsertProfile", () => {
  it("happy path — upserts and returns ok", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", validInput, deps);
    expect(result).toEqual({ ok: true });
    expect(deps.upsertProfile).toHaveBeenCalledWith("user1", validInput);
  });

  it("username taken by another user — returns error", async () => {
    const deps = makeDeps({
      findByUsername: vi.fn().mockResolvedValue({ userId: "other-user" }),
    });
    const result = await runUpsertProfile("user1", validInput, deps);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/đã được sử dụng/i);
    expect(deps.upsertProfile).not.toHaveBeenCalled();
  });

  it("same user updating their own username — ok (not a conflict)", async () => {
    const deps = makeDeps({
      findByUsername: vi.fn().mockResolvedValue({ userId: "user1" }),
    });
    const result = await runUpsertProfile("user1", validInput, deps);
    expect(result).toEqual({ ok: true });
  });

  it("username too short (< 3 chars) — returns error", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", { ...validInput, username: "ab" }, deps);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/username/i);
    expect(deps.upsertProfile).not.toHaveBeenCalled();
  });

  it("username too long (> 30 chars) — returns error", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", { ...validInput, username: "a".repeat(31) }, deps);
    expect(result.ok).toBe(false);
    expect(deps.upsertProfile).not.toHaveBeenCalled();
  });

  it("username with space (invalid char) — returns error", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", { ...validInput, username: "nguyen a" }, deps);
    expect(result.ok).toBe(false);
    expect(deps.upsertProfile).not.toHaveBeenCalled();
  });

  it("username starts with dash — returns error", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", { ...validInput, username: "-nguyena" }, deps);
    expect(result.ok).toBe(false);
  });

  it("bio over 300 chars — returns error", async () => {
    const deps = makeDeps();
    const result = await runUpsertProfile("user1", { ...validInput, bio: "x".repeat(301) }, deps);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/giới thiệu/i);
    expect(deps.upsertProfile).not.toHaveBeenCalled();
  });
});
