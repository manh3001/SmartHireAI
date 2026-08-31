import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma và auth
vi.mock("@/lib/db/prisma", () => ({
  default: {
    cV: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    application: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/cache/tags", () => ({
  CACHE_TAGS: { cv: "cv", dashboard: "dashboard" },
}));

import prisma from "@/lib/db/prisma";
import { renameCv, setDefaultCv, enableShare, disableShare } from "@/lib/cv/actions";

const mockPrisma = prisma as unknown as {
  cV: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  application: { count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("renameCv", () => {
  it("returns error if CV not owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue(null);
    const result = await renameCv("cv-1", "Tên mới");
    expect(result).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("updates title when owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    mockPrisma.cV.update.mockResolvedValue({});
    const result = await renameCv("cv-1", "Tên mới");
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.cV.update).toHaveBeenCalledWith({
      where: { id: "cv-1" },
      data: { title: "Tên mới" },
    });
  });
});

describe("setDefaultCv", () => {
  it("returns error if CV not owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue(null);
    const result = await setDefaultCv("cv-1");
    expect(result).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("unsets all then sets target via transaction", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    const txFn = vi.fn();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        cV: {
          updateMany: txFn,
          update: txFn,
        },
      };
      return fn(tx);
    });
    const result = await setDefaultCv("cv-1");
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});

describe("enableShare", () => {
  it("returns error if CV not owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue(null);
    const result = await enableShare("cv-1");
    expect(result).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });

  it("generates token and saves", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    mockPrisma.cV.update.mockResolvedValue({ shareToken: "abc123def456" });
    const result = await enableShare("cv-1");
    expect(result.ok).toBe(true);
    expect(typeof result.token).toBe("string");
    expect(result.token!.length).toBe(12);
  });
});

describe("disableShare", () => {
  it("sets shareToken null when owned", async () => {
    mockPrisma.cV.findFirst.mockResolvedValue({ id: "cv-1" });
    mockPrisma.cV.update.mockResolvedValue({});
    const result = await disableShare("cv-1");
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.cV.update).toHaveBeenCalledWith({
      where: { id: "cv-1" },
      data: { shareToken: null },
    });
  });
});
