import { test, expect } from "@playwright/test";

// Most tests use auth state injected via storageState (candidate.json) from global setup.

test("notifications: /notifications page renders for logged-in user", async ({
  page,
}) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL("/notifications");
  await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
});

test("notifications: bell icon visible in navbar after login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  // Bell icon has aria-label="Thông báo"
  await expect(page.locator('[aria-label="Thông báo"]')).toBeVisible({
    timeout: 15000,
  });
});

test("notifications: unauthenticated /notifications redirects to /login", async ({
  page,
}) => {
  // Clear all cookies to simulate unauthenticated state
  await page.context().clearCookies();
  await page.goto("/notifications");
  // Auth redirects may append callbackUrl query param
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
});
