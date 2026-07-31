import { describe, it, expect } from "vitest";
import {
  statusChangeNotification,
  newMessageNotification,
  newApplicationNotification,
} from "../messages";

describe("notification messages", () => {
  it("statusChangeNotification", () => {
    const r = statusChangeNotification("Frontend Dev", "Phỏng vấn");
    expect(r.message).toBe('Đơn ứng tuyển "Frontend Dev" đã chuyển sang "Phỏng vấn"');
    expect(r.link).toBe("/applications");
  });

  it("newMessageNotification", () => {
    const r = newMessageNotification("An", "Frontend Dev", "app_1");
    expect(r.message).toBe('An đã nhắn tin cho bạn về "Frontend Dev"');
    expect(r.link).toBe("/messages/app_1");
  });

  it("newApplicationNotification", () => {
    const r = newApplicationNotification("Bình", "Frontend Dev", "job_1");
    expect(r.message).toBe('Bình đã ứng tuyển "Frontend Dev"');
    expect(r.link).toBe("/jobs/job_1/applicants");
  });
});
