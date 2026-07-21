import { expect, test } from "@playwright/test";

const forbiddenTexts = [/is not a function/i, /Something went wrong/i];
const forbiddenConsole = /is not a function|Something went wrong/i;

async function expectStudentHomeStable(page: import("@playwright/test").Page) {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("/student", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Что делать/i })).toBeVisible();

  for (const text of forbiddenTexts) {
    await expect(page.locator("body")).not.toContainText(text);
  }
  expect(runtimeErrors.join("\n")).not.toMatch(forbiddenConsole);
}

test.describe("student home regression", () => {
  test("empty student state does not crash", async ({ page }) => {
    await expectStudentHomeStable(page);
  });

  test("partially populated student state does not crash", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("student-home-fixture", "partial"));
    await expectStudentHomeStable(page);
  });

  test("fully populated student state does not crash", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("student-home-fixture", "full"));
    await expectStudentHomeStable(page);
  });
});