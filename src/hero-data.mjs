export function matchups(rows, minimum = 30) {
  return rows
    .filter(
      (x) =>
        Number.isFinite(x.games_played) &&
        x.games_played >= minimum &&
        Number.isFinite(x.wins) &&
        x.wins >= 0 &&
        x.wins <= x.games_played,
    )
    .map((x) => ({ ...x, winrate: (x.wins / x.games_played) * 100 }));
}
export function popularItems(counts, items) {
  const byId = new Map(
    Object.entries(items).map(([key, value]) => [
      String(value.id),
      { ...value, key },
    ]),
  );
  return Object.entries(counts || {})
    .map(([id, count]) => ({ item: byId.get(id), count }))
    .filter(
      (x) =>
        x.item &&
        !x.item.key.startsWith("recipe_") &&
        Number.isFinite(x.count) &&
        x.count > 0,
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}
export function matchSummary(match) {
  const lines = [];
  const p = (match.players || []).filter((x) =>
    Number.isFinite(x.gold_per_min),
  );
  if (p.length) {
    const top = p.reduce((a, b) => (a.gold_per_min >= b.gold_per_min ? a : b));
    lines.push({
      type: "farm",
      heroId: top.hero_id,
      text: `Лидер по золоту в минуту: ${top.gold_per_min} GPM.`,
    });
  }
  const adv = match.radiant_gold_adv;
  if (Array.isArray(adv) && adv.length > 1 && adv.every(Number.isFinite)) {
    let at = 1;
    for (let i = 2; i < adv.length; i++)
      if (Math.abs(adv[i] - adv[i - 1]) > Math.abs(adv[at] - adv[at - 1]))
        at = i;
    const swing = adv[at] - adv[at - 1];
    if (swing)
      lines.push({
        type: "swing",
        text: `Самое большое изменение преимущества по золоту: ${at}-я минута, ${Math.abs(swing).toLocaleString("ru-RU")} в пользу ${swing > 0 ? "Света" : "Тьмы"}. Это изменение баланса за минуту, а не заработок команды.`,
      });
    const loserWasAhead =
      match.radiant_win === true
        ? Math.min(...adv) < -5000
        : match.radiant_win === false
          ? Math.max(...adv) > 5000
          : false;
    if (loserWasAhead)
      lines.push({
        type: "comeback",
        text: "Победитель отыграл преимущество соперника более 5 000 золота.",
      });
  }
  if (!Array.isArray(adv) || adv.length < 2)
    lines.push({
      type: "missing",
      text: "Нет поминутных данных: для подробного разбора запроси обработку матча в OpenDota.",
    });
  return lines;
}
