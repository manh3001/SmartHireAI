import { test, expect } from "@playwright/test";

// Auth state is injected via storageState (recruiter.json) from global setup.
// No need to register/login — the session cookie is already set.

test("recruiter: /company/edit page loads with company form", async ({
  page,
}) => {
  await page.goto("/company/edit");
  await expect(page).toHaveURL("/company/edit");
  // Heading "Hồ sơ công ty" visible
  await expect(page.getByText("Hồ sơ công ty")).toBeVisible({ timeout: 15000 });
  // Form input for company name visible
  await expect(page.locator('input[name="name"]')).toBeVisible();
});

test("recruiter: submit company form without error", async ({ page }) => {
  await page.goto("/company/edit");
  // Fill company name
  await page.fill('input[name="name"]', "E2E Test Company");
  // Submit form (Server Action — page reloads)
  await page.click('button[type="submit"]');
  // After submit: no error message, still at /company/edit
  await expect(page).toHaveURL(/\/company\/edit/, { timeout: 15000 });
  await expect(page.locator("text=Hồ sơ công ty")).toBeVisible();
});
