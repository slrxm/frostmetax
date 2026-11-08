import { test, expect } from "@playwright/test";
test("mobile layout, downloads, search and account availability", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#list .row:not(.head)").first()).toBeVisible();
  await page.locator("#q").fill("Axe");
  await expect(page.locator("#list .row:not(.head)")).toHaveCount(1);
  await page.locator("#downloadApp").click();
  await expect(page.locator("#downloadDialog")).toBeVisible();
  await expect(page.locator(".store[aria-disabled=true]")).toHaveCount(2);
  await page.locator("#closeDownload").click();
  await page.locator("#accountButton").click();
  await expect(page.locator("#accountPanel")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Войти через Google", exact: true }),
  ).toBeDisabled();
  const width = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    innerWidth,
  ]);
  expect(width[0]).toBeLessThanOrEqual(width[1]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("frostmeta-mobile.png"),
    fullPage: true,
  });
});
test("empty rank slice is handled without a JavaScript crash", async ({
  page,
}) => {
  await page.route("**/data.json", (r) =>
    r.fulfill({
      json: {
        ranks: ["Immortal"],
        roles: ["Carry"],
        data: { "0|0": [] },
        updated: "2026-11-07",
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("#list")).toContainText("пока нет данных");
});
test("offline refresh shows a useful status and retains current rows", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator("#list .row:not(.head)").first()).toBeVisible();
  await context.setOffline(true);
  await page.locator("#refreshMeta").click();
  await expect(page.locator("#metaStatus")).toContainText("Не удалось");
  await expect(page.locator("#list .row:not(.head)").first()).toBeVisible();
});
