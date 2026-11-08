import test from "node:test";
import assert from "node:assert/strict";
import { matchups, popularItems, matchSummary } from "../src/hero-data.mjs";
test("matchup winrate uses selected hero wins and excludes unreliable counts", () => {
  assert.deepEqual(
    matchups([
      { hero_id: 1, games_played: 100, wins: 35 },
      { hero_id: 3, games_played: 29, wins: 29 },
      { hero_id: 4, games_played: 50, wins: 51 },
    ]).map((x) => x.winrate),
    [35],
  );
});
test("item counts omit unknown IDs and recipes", () => {
  assert.deepEqual(
    popularItems(
      { 1: 20, 2: 100, 3: 500 },
      { blink: { id: 1, dname: "Blink" }, recipe_blink: { id: 2 } },
    ).map((x) => [x.item.key, x.count]),
    [["blink", 20]],
  );
});
test("match analysis identifies a comeback and signed minute swing", () => {
  const lines = matchSummary({
    radiant_win: true,
    radiant_gold_adv: [-6000, -5000, 1000],
    players: [],
  });
  assert.ok(lines.some((x) => x.type === "comeback"));
  assert.match(lines.find((x) => x.type === "swing").text, /2-я минута/);
  assert.match(lines.find((x) => x.type === "swing").text, /Света/);
});
test("missing replay metrics are not treated as zero or blame", () => {
  assert.deepEqual(
    matchSummary({ players: [{ hero_id: 2 }] }).map((x) => x.type),
    ["missing"],
  );
});
