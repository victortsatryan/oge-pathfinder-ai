import { expect, test } from "@playwright/test";

const forbiddenConsole = /is not a function|Cannot read properties of undefined/i;

const routes = [
  "/student",
  "/student/profile",
  "/student/lessons",
  "/student/calendar",
  "/student/path",
  "/student/library",
  "/student/diagnostic",
  "/teacher",
  "/teacher/students",
  "/admin/community",
  "/dev/data-health",
];

test.describe("routes smoke", () => {
  for (const route of routes) {
    test(`${route} renders without data-shape errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("body")).not.toContainText(/is not a function/i);
      expect(errors.join("\n")).not.toMatch(forbiddenConsole);
    });
  }
});
