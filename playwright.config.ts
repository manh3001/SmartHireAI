import { defineConfig, devices } from "@playwright/test";
import path from "path";

const AUTH_DIR = path.join(__dirname, "e2e/.auth");

export default defineConfig({
  testDir: "e2e",
  // Exclude global-setup.ts from being run as a test file
  testIgnore: "**/global-setup.ts",
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "chromium-candidate",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "candidate.json"),
      },
      testMatch: /candidate\.spec\.ts/,
    },
    {
      name: "chromium-recruiter",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "recruiter.json"),
      },
      testMatch: /recruiter\.spec\.ts/,
    },
    {
      name: "chromium-notifications",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(AUTH_DIR, "candidate.json"),
      },
      testMatch: /notifications\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
