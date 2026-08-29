import type { Page } from "@playwright/test";

export function unique() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Wait for React hydration on current page by checking React fiber on form element */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const form = document.querySelector("form");
      if (!form) return false;
      const keys = Object.getOwnPropertyNames(form);
      return keys.some(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"),
      );
    },
    { timeout: 15000 },
  );
}

export async function registerAndLogin(
  page: Page,
  role: "CANDIDATE" | "RECRUITER" = "CANDIDATE",
): Promise<{ email: string; password: string }> {
  const email = `${unique()}@e2e.test`;
  const password = "password123";

  await page.goto("/register");
  await waitForHydration(page);
  await page.fill('[name="name"]', "E2E User");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.selectOption('[name="role"]', role);
  await page.click('button[type="submit"]');
  await page.waitForURL("/login", { timeout: 30000 });

  await waitForHydration(page);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard", { timeout: 30000 });

  return { email, password };
}
