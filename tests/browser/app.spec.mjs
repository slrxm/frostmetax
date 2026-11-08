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
test('player, comparison and match analysis remain functional',async({page})=>{
 await page.route('https://api.opendota.com/api/**',r=>{
 const path=new URL(r.request().url()).pathname.replace('/api/','');
 let data={};
 if(path==='heroes')data=[{id:2,localized_name:'Axe',name:'npc_dota_hero_axe'}];
 else if(path.startsWith('players/')){
  const [,id,part]=path.split('/');
  data=!part?{profile:{personaname:id==='123'?'Alpha':'Beta'},rank_tier:50}:part==='wl'?{win:6,lose:4}:part==='heroes'?[{hero_id:2,games:10,win:6}]:[];
 }else if(path.startsWith('matches/'))data={match_id:900001,radiant_win:true,radiant_score:20,dire_score:10,duration:1800,start_time:1700000000,game_mode:1,radiant_gold_adv:[-6000,-5000,1000],radiant_xp_adv:[0,100,500],players:[{hero_id:2,player_slot:0,kills:10,deaths:2,assists:5,gold_per_min:600},{hero_id:2,player_slot:128,kills:2,deaths:10,assists:1,gold_per_min:300}]};
 return r.fulfill({json:data});
 });
 await page.goto('/');await page.locator('#nv2').click();await page.locator('#pid').fill('123');await page.locator('#pid').press('Enter');await expect(page.locator('#pres')).toContainText('Alpha');await expect(page.locator('#pres')).toContainText('60.0%');
 await page.locator('#nv3').click();await page.locator('#ca').fill('123');await page.locator('#cb').fill('456');await page.locator('#cb').press('Enter');await expect(page.locator('#cres')).toContainText('Alpha');await expect(page.locator('#cres')).toContainText('Beta');
 await page.locator('#nv1').click();await page.locator('#mid').fill('900001');await page.locator('#mid').press('Enter');await expect(page.locator('#matchAnalysis')).toContainText('600 GPM');await expect(page.locator('#matchAnalysis')).toContainText('отыграл');await expect(page.locator('#chartbox svg')).toBeVisible();
});
test('Dota IDs validate platform and numeric range',async({page})=>{await page.goto('/');const ids=await page.evaluate(()=>['123','76561198083722517','https://steamcommunity.com/profiles/76561198083722517','https://www.dotabuff.com/players/123','0','4294967296','https://evil.test/players/123'].map(x=>window.parseId(x)));expect(ids).toEqual(['123','123456789','123456789','123',null,null,null]);});
