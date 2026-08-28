import { describe, it, expect } from "vitest";
import { CACHE_TAGS } from "../tags";

describe("CACHE_TAGS", () => {
  it("exports all 6 required tags", () => {
    const required = ["jobs", "company", "applications", "notifications", "cv", "dashboard"] as const;
    for (const key of required) {
      expect(CACHE_TAGS[key]).toBe(key);
    }
    expect(Object.keys(CACHE_TAGS)).toHaveLength(6);
  });
});
