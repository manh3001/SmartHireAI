import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const STATE_DIR = path.join(__dirname, ".auth");

function unique() {
  return `setup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function waitForHydration(page: import("@playwright/test").Page) {
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

async function registerAndSaveState(
  page: import("@playwright/test").Page,
  role: "CANDIDATE" | "RECRUITER",
  stateFile: string,
) {
  const email = `${unique()}@e2e.test`;
  const password = "password123";

  await page.goto(`${BASE_URL}/register`);
  await waitForHydration(page);
  await page.fill('[name="name"]', `E2E ${role}`);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.selectOption('[name="role"]', role);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/login`, { timeout: 30000 });

  await waitForHydration(page);
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 30000 });

  await page.context().storageState({ path: stateFile });
}

export default async function globalSetup(_config: FullConfig) {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }

  const browser = await chromium.launch();

  try {
    // Register and save CANDIDATE session
    const candidatePage = await browser.newPage();
    await registerAndSaveState(
      candidatePage,
      "CANDIDATE",
      path.join(STATE_DIR, "candidate.json"),
    );
    await candidatePage.close();

    // Register and save RECRUITER session
    const recruiterPage = await browser.newPage();
    await registerAndSaveState(
      recruiterPage,
      "RECRUITER",
      path.join(STATE_DIR, "recruiter.json"),
    );
    await recruiterPage.close();
  } finally {
    await browser.close();
  }
}
