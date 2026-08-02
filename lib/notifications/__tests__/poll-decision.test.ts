import { describe, it, expect } from "vitest";
import { decidePollAction, type NotificationSignal } from "../poll-decision";

const n = (id: string, link = "/notifications"): NotificationSignal["latest"] => ({
  id,
  message: `msg ${id}`,
  link,
});

describe("decidePollAction", () => {
  it("count tăng → shouldRefresh", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("a") };
    expect(decidePollAction(prev, next, "/dashboard").shouldRefresh).toBe(true);
  });

  it("count giảm (mark read) → shouldRefresh, không toast", () => {
    const prev: NotificationSignal = { unreadCount: 3, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 0, latest: n("a") };
    const r = decidePollAction(prev, next, "/dashboard");
    expect(r.shouldRefresh).toBe(true);
    expect(r.toast).toBeNull();
  });

  it("không đổi gì → không refresh, không toast", () => {
    const prev: NotificationSignal = { unreadCount: 2, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("a") };
    const r = decidePollAction(prev, next, "/dashboard");
    expect(r.shouldRefresh).toBe(false);
    expect(r.toast).toBeNull();
  });

  it("latest id mới, link khác path → toast", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("b", "/messages/x") };
    const r = decidePollAction(prev, next, "/dashboard");
    expect(r.toast).toEqual({ message: "msg b", link: "/messages/x" });
  });

  it("latest id mới nhưng link trùng path → không toast (vẫn refresh nếu count đổi)", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("b", "/messages/x") };
    const r = decidePollAction(prev, next, "/messages/x");
    expect(r.toast).toBeNull();
    expect(r.shouldRefresh).toBe(true);
  });

  it("prev.latest null → next.latest coi là mới", () => {
    const prev: NotificationSignal = { unreadCount: 0, latest: null };
    const next: NotificationSignal = { unreadCount: 1, latest: n("a", "/applications") };
    expect(decidePollAction(prev, next, "/dashboard").toast).toEqual({
      message: "msg a",
      link: "/applications",
    });
  });

  it("next.latest null → không toast", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 0, latest: null };
    expect(decidePollAction(prev, next, "/dashboard").toast).toBeNull();
  });
});
