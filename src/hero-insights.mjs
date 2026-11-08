import { matchups, popularItems, matchSummary } from "./hero-data.mjs";
import { createJSONClient } from "./request-json.mjs";
const get = createJSONClient({ baseUrl: "https://api.opendota.com/api/" });
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function section(root, title, note) {
  const s = el("section", null, "insight-section");
  s.append(el("h3", title));
  if (note) s.append(el("p", note, "small-note"));
  root.append(s);
  return s;
}
export function initInsights() {
  const dialog = document.getElementById("heroDialog"),
    body = document.getElementById("heroBody");
  let version = 0;
  document.getElementById("closeHero").onclick = () => {
    version++;
    dialog.close();
  };
  dialog.addEventListener("close", () => version++);
  async function open(name, id) {
    const current = ++version;
    document.getElementById("heroTitle").textContent = name;
    body.replaceChildren();
    if (!dialog.open) dialog.showModal();
    const meta = window.getHeroContext(name);
    if (meta) {
      const s = section(
        body,
        "Мета в выбранном фильтре",
        `${meta.rank} · ${meta.role} · STRATZ · ${meta.sourceWindow === "day" ? "суточная" : "недельная"} выборка`,
      );
      s.append(
        el(
          "p",
          `Винрейт ${meta.wr.toFixed(1)}% · пикрейт ${meta.pr.toFixed(1)}%${meta.matches ? ` · ${meta.matches.toLocaleString("ru-RU")} матчей` : ""}`,
        ),
      );
    }
    const loading = el("p", "Загружаем сборки и соперников…", "small-note");
    body.append(loading);
    try {
      const heroes = await get("heroes");
      if (current !== version) return;
      const hero =
        heroes.find((x) => Number(x.id) === id) ||
        heroes.find((x) => x.localized_name === name);
      if (!hero) throw Error("Герой не найден в OpenDota.");
      id = hero.id;
      const names = new Map(heroes.map((x) => [x.id, x.localized_name]));
      const results = await Promise.allSettled([
        get(`heroes/${id}/matchups`),
        get(`heroes/${id}/itemPopularity`),
        get("constants/items"),
      ]);
      if (current !== version) return;
      loading.remove();
      const counter = section(
        body,
        "Контрпики: результаты против соперников",
        "OpenDota · профессиональные матчи за последний год. Показан винрейт выбранного героя против каждого соперника, минимум 30 игр. Выборка включает разные патчи; фильтры рейтинга и позиции здесь не применяются.",
      );
      if (results[0].status === "fulfilled") {
        const rows = matchups(results[0].value);
        if (!rows.length)
          counter.append(
            el("p", "Недостаточно матчей для сравнения.", "small-note"),
          );
        else {
          for (const [label, list] of [
            [
              "Сложные соперники",
              rows
                .filter((x) => x.winrate < 50)
                .sort((a, b) => a.winrate - b.winrate)
                .slice(0, 6),
            ],
            [
              "Удобные соперники",
              rows
                .filter((x) => x.winrate >= 50)
                .sort((a, b) => b.winrate - a.winrate)
                .slice(0, 6),
            ],
          ]) {
            counter.append(el("h4", label));
            if (!list.length)
              counter.append(
                el(
                  "p",
                  "Нет соперников с достаточной выборкой в этой группе.",
                  "small-note",
                ),
              );
            for (const row of list) {
              const r = el("div", null, "insight-row");
              const b = el(
                "button",
                names.get(row.hero_id) || `Герой ${row.hero_id}`,
                "hero-link",
              );
              b.onclick = () => {
                open(
                  names.get(row.hero_id) || `Герой ${row.hero_id}`,
                  row.hero_id,
                );
              };
              r.append(
                b,
                el(
                  "span",
                  `${row.winrate.toFixed(1)}% · ${row.games_played} игр`,
                ),
              );
              counter.append(r);
            }
          }
        }
      } else counter.append(el("p", results[0].reason.message, "small-note"));
      const builds = section(
        body,
        "Предметы по стадиям игры",
        "OpenDota · до 100 последних разобранных профессиональных матчей. Числа — количество покупок, не винрейт предмета. Популярные варианты не образуют готовую сборку: выбор зависит от роли и соперников.",
      );
      if (
        results[1].status === "fulfilled" &&
        results[2].status === "fulfilled"
      ) {
        for (const [key, label] of [
          ["start_game_items", "Старт"],
          ["early_game_items", "Ранняя игра · до 10 минут"],
          ["mid_game_items", "Середина игры · 10–25 минут"],
          ["late_game_items", "Поздняя игра · после 25 минут"],
        ]) {
          builds.append(el("h4", label));
          const list = popularItems(results[1].value[key], results[2].value);
          if (!list.length) builds.append(el("p", "Нет данных.", "small-note"));
          for (const x of list) {
            const r = el("div", null, "insight-row");
            r.append(
              el("span", x.item.dname || x.item.key),
              el("span", `${x.count} покупок`),
            );
            builds.append(r);
          }
        }
      } else
        builds.append(
          el(
            "p",
            "Не удалось загрузить предметы. Закрой карточку и повтори попытку.",
            "small-note",
          ),
        );
      const recent = section(
        body,
        "Матчи на герое",
        "Профессиональные матчи из выборки OpenDota. Открой матч для таблицы игроков, предметов и разбора.",
      );
      const button = el("button", "Загрузить последние матчи", "quiet");
      recent.append(button);
      button.onclick = async () => {
        button.disabled = true;
        try {
          const rows = await get(`heroes/${id}/matches`);
          if (current !== version) return;
          for (const m of rows.slice(0, 10)) {
            const b = el(
              "button",
              `Матч ${m.match_id} · ${new Date(m.start_time * 1000).toLocaleDateString("ru-RU")}`,
              "quiet match-shortcut",
            );
            b.onclick = () => {
              dialog.close();
              window.openMatch(m.match_id);
            };
            recent.append(b);
          }
          if (!rows.length) recent.append(el("p", "Матчей пока нет."));
          button.remove();
        } catch (e) {
          button.disabled = false;
          button.textContent = e.message + " Повторить";
        }
      };
    } catch (e) {
      if (current === version) {
        loading.textContent = e.message;
        if (!loading.isConnected) body.append(loading);
        const retry = el("button", "Повторить", "quiet");
        retry.onclick = () => {
          open(name, id);
        };
        body.append(retry);
      }
    }
  }
  document.getElementById("list").addEventListener("click", (event) => {
    const b = event.target.closest("[data-hero-name]");
    if (b) open(b.dataset.heroName, Number(b.dataset.heroId));
  });
  window.addEventListener("frostmeta:match", (event) => {
    const { match, heroes } = event.detail;
    const target = document.getElementById("matchAnalysis");
    if (!target) return;
    target.replaceChildren(el("h3", "Краткий разбор"));
    for (const row of matchSummary(match)) {
      target.append(
        el(
          "p",
          (row.heroId ? `${heroes[row.heroId] || "Герой"}: ` : "") + row.text,
        ),
      );
    }
    target.append(
      el(
        "p",
        "Выводы рассчитаны по доступным цифрам матча. Они не определяют причины победы или качество решений игрока.",
        "small-note",
      ),
    );
  });
}
