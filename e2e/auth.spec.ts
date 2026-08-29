import { test, expect, type Page } from "@playwright/test";

// Rate-limiter note: globalSetup pre-registers 2 users (candidate + recruiter).
// These 3 tests register 2 more (login and logout tests share 1, register test uses 1).
// Total: ~4 of the 5 registrations/hour budget. Running e2e twice in the same hour
// will exhaust the limit. Restart the dev server to reset in-memory state.

function unique() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Wait for React hydration on current page by checking React fiber on form element */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    if (!form) return false;
    // React stores fiber on the DOM node — check all own property names (including non-enumerable)
    const keys = Object.getOwnPropertyNames(form);
    return keys.some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
  }, { timeout: 15000 });
}

async function registerUser(page: Page, email: string, password: string, role = "CANDIDATE") {
  await page.goto("/register");
  await waitForHydration(page);
  await page.fill('[name="name"]', "E2E Test User");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.selectOption('[name="role"]', role);
  await page.click('button[type="submit"]');
  await page.waitForURL("/login", { timeout: 30000 });
}

test("register redirects to /login", async ({ page }) => {
  const email = `${unique()}@e2e.test`;
  await page.goto("/register");
  await waitForHydration(page);
  await page.fill('[name="name"]', "E2E Test User");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "password123");
  await page.selectOption('[name="role"]', "CANDIDATE");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/login", { timeout: 30000 });
});

test("login redirects to /dashboard", async ({ page }) => {
  const email = `${unique()}@e2e.test`;
  await registerUser(page, email, "password123");
  await waitForHydration(page);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/dashboard", { timeout: 30000 });
});

test("logout redirects to /login", async ({ page }) => {
  const email = `${unique()}@e2e.test`;
  await registerUser(page, email, "password123");
  // Login
  await waitForHydration(page);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard", { timeout: 30000 });
  // Logout — button text "Đăng xuất" inside a form
  await page.click('button:has-text("Đăng xuất")');
  await expect(page).toHaveURL("/login", { timeout: 30000 });
});
