import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/data.json", (r) =>
    r.fulfill({
      json: {
        ranks: ["Legend"],
        roles: ["Carry"],
        data: {
          "0|0": [
            { hero: "Axe", heroId: 2, wr: 55, pr: 5, tr: 1, matches: 200 },
          ],
        },
        updated: "2026-11-08",
        sourceWindow: "day",
      },
    }),
  );
});
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
  await page.locator("#localDotaId").fill("123456789");
  await page
    .getByRole("button", { name: "Сохранить профиль", exact: true })
    .click();
  await page.reload();
  await page.locator("#accountButton").click();
  await expect(page.locator("#localDotaId")).toHaveValue("123456789");
  await expect(
    page.getByRole("button", { name: "Войти через Google", exact: true }),
  ).toHaveCount(0);
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
  await page.route("**/data.json", (r) => r.abort());
  await context.setOffline(true);
  await page.locator("#refreshMeta").click();
  await expect(page.locator("#metaStatus")).toContainText("Не удалось");
  await expect(page.locator("#list .row:not(.head)").first()).toBeVisible();
});
test("hero details show matchup direction, sample and item counts", async ({
  page,
}) => {
  await page.route("https://api.opendota.com/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const data = p.endsWith("/heroes")
      ? [
          { id: 2, localized_name: "Axe" },
          { id: 1, localized_name: "Anti-Mage" },
          { id: 3, localized_name: "Bane" },
        ]
      : p.endsWith("/matchups")
        ? [
            { hero_id: 1, games_played: 100, wins: 35 },
            { hero_id: 3, games_played: 100, wins: 70 },
          ]
        : p.endsWith("/itemPopularity")
          ? { early_game_items: { 50: 80 } }
          : p.endsWith("/constants/items")
            ? { phase_boots: { id: 50, dname: "Phase Boots" } }
            : [];
    return route.fulfill({ json: data });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Axe ↗", exact: true }).click();
  const dialog = page.locator("#heroDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("55.0%");
  await expect(dialog).toContainText("35.0% · 100 игр");
  await expect(dialog).toContainText("80 покупок");
  await expect(dialog).toContainText("не винрейт предмета");
  await dialog.getByRole("button", { name: "Anti-Mage", exact: true }).click();
  await expect(page.locator("#heroTitle")).toHaveText("Anti-Mage");
  await expect(dialog.getByText("Phase Boots")).toBeVisible();
});
test("failed matchup requests do not hide available item statistics", async ({
  page,
}) => {
  await page.route("https://api.opendota.com/api/**", (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p.endsWith("/matchups"))
      return r.fulfill({ status: 429, json: { error: "rate limit" } });
    return r.fulfill({
      json: p.endsWith("/heroes")
        ? [{ id: 2, localized_name: "Axe" }]
        : p.endsWith("/itemPopularity")
          ? { early_game_items: { 50: 8 } }
          : { phase_boots: { id: 50, dname: "Phase Boots" } },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Axe ↗", exact: true }).click();
  await expect(page.locator("#heroBody")).toContainText("ограничил запросы");
  await expect(page.locator("#heroBody")).toContainText("Phase Boots");
});
