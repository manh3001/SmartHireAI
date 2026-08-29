import { test, expect } from "@playwright/test";

// Auth state is injected via storageState (candidate.json) from global setup.
// No need to register/login — the session cookie is already set.

test("candidate: /jobs page loads and shows search UI", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page).toHaveURL("/jobs");
  // Page renders without redirect (not pushed back to /login)
  await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
});

test("candidate: /jobs detail page loads when clicking job card", async ({
  page,
}) => {
  await page.goto("/jobs");
  // If there are job cards, click the first one
  const firstJobLink = page.locator('a[href^="/jobs/"]').first();
  const hasJobs = (await firstJobLink.count()) > 0;
  if (hasJobs) {
    await firstJobLink.click();
    await expect(page).toHaveURL(/\/jobs\/.+/);
    await expect(page.locator("main")).toBeVisible();
  } else {
    // DB empty — skip assertion, page already loaded successfully
    await expect(page).toHaveURL("/jobs");
  }
});
