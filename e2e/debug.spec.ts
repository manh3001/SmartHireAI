import { test } from "@playwright/test";

test("debug - check JS execution and console errors", async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  page.on("console", (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const evalResult = await page.evaluate(() => {
    // Check if React is loaded
    const reactLoaded = typeof (window as unknown as Record<string, unknown>).React !== "undefined";
    // Check document keys for any __next vars
    const allWindowKeys = Object.getOwnPropertyNames(window).filter(k =>
      k.startsWith("__next") || k.startsWith("__NEXT") || k.startsWith("__react") || k.startsWith("next")
    );

    return {
      reactLoaded,
      allWindowKeys,
      scriptTags: Array.from(document.querySelectorAll("script")).map(s => ({
        src: s.src,
        type: s.type,
      })).slice(0, 10),
    };
  });

  console.log("Eval result:", JSON.stringify(evalResult, null, 2));
  console.log("Console messages:", consoleMessages.slice(0, 20));
  console.log("Errors:", errors);
});
