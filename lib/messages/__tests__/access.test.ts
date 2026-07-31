import { describe, it, expect } from "vitest";
import { isThreadParticipant } from "../access";

const thread = { candidateId: "cand", recruiterId: "rec" };

describe("isThreadParticipant", () => {
  it("true cho ứng viên", () => {
    expect(isThreadParticipant("cand", thread)).toBe(true);
  });
  it("true cho NTD", () => {
    expect(isThreadParticipant("rec", thread)).toBe(true);
  });
  it("false cho người ngoài", () => {
    expect(isThreadParticipant("other", thread)).toBe(false);
  });
});
