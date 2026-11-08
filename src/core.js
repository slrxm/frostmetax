let DB = { ranks: [], roles: [], data: {} };
window.applyMeta = function (j) {
  DB = j;
  rank = Math.min(rank, DB.ranks.length - 1);
  role = Math.min(role, DB.roles.length - 1);
  render();
};
let rank = 2,
  role = 0;
window.getHeroContext = (name) => {
  const h = (DB.data[rank + "|" + role] || []).find((x) => x.hero === name);
  return h
    ? {
        ...h,
        rank: DB.ranks[rank],
        role: DB.roles[role],
        sourceWindow: DB.sourceWindow,
      }
    : null;
};
const $ = (id) => document.getElementById(id);
function tabs(el, items, cur, fn) {
  el.innerHTML = "";
  items.forEach((t, i) => {
    const b = document.createElement("button");
    b.className = "tab" + (i === cur ? " on" : "");
    b.textContent = t;
    b.onclick = () => fn(i);
    el.appendChild(b);
  });
}
function tier(w) {
  return w >= 52.5 ? "S" : w >= 50.8 ? "A" : w >= 49 ? "B" : "C";
}
function render() {
  tabs($("ranks"), DB.ranks, rank, (i) => {
    rank = i;
    render();
  });
  tabs($("roles"), DB.roles, role, (i) => {
    role = i;
    render();
  });
  let d = (DB.data[rank + "|" + role] || []).slice();
  const k = $("sort").value;
  d.sort((a, b) => b[k] - a[k]);
  if (!d.length) {
    $("top").innerHTML = "";
    $("list").innerHTML =
      '<div class="empty">Для этого рейтинга и позиции пока нет данных. Выберите другой фильтр.</div>';
    return;
  }
  const best = [...d].sort((a, b) => b.wr - a.wr)[0],
    pop = [...d].sort((a, b) => b.pr - a.pr)[0],
    rise = [...d].sort((a, b) => b.tr - a.tr)[0];
  $("top").innerHTML = [
    ["Лучший винрейт", best, best.wr.toFixed(1) + "%"],
    ["Самый популярный", pop, pop.pr.toFixed(1) + "% пиков"],
    [
      "Растёт быстрее всех",
      rise,
      (rise.tr >= 0 ? "+" : "") + rise.tr.toFixed(1) + " п.п.",
    ],
  ]
    .map(
      ([t, h, s]) =>
        `<div class="card"><div class="k">${t}</div><div class="v">${esc(h.hero)}</div><div class="s">${s}</div></div>`,
    )
    .join("");
  const q = $("q").value.trim().toLowerCase();
  const f = d.filter((x) => x.hero.toLowerCase().includes(q));
  $("list").innerHTML =
    `<div class="row head"><div>Тир</div><div>Герой</div><div>Винрейт</div><div class="num">Пик</div><div class="num">Тренд</div></div>` +
    (f.length
      ? f
          .map((x) => {
            const t = tier(x.wr),
              ini = x.hero
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2);
            return `<div class="row"><div class="tier t${t}">${t}</div><div class="hero"><span class="av">${ini}</span><button class="hero-link" data-hero-id="${Number(x.heroId) || 0}" data-hero-name="${esc(x.hero)}">${esc(x.hero)} ↗</button></div>
   <div class="wr"><b>${x.wr.toFixed(1)}%</b><div class="trk"><div class="fill" style="width:${Math.max(0, Math.min(100, ((x.wr - 44) / 12) * 100))}%"></div></div></div>
   <div class="num">${x.pr.toFixed(1)}%</div><div class="num ${x.tr >= 0 ? "up" : "dn"}">${x.tr >= 0 ? "▲" : "▼"} ${Math.abs(x.tr).toFixed(1)}</div></div>`;
          })
          .join("")
      : `<div class="empty">Герой не найден</div>`);
}
$("q").oninput = render;
$("sort").onchange = render;

function view(i) {
  ["metaView", "matchView", "playerView", "cmpView"].forEach(
    (v, j) => ($(v).style.display = i === j ? "" : "none"),
  );
  [0, 1, 2, 3].forEach(
    (j) => ($("nv" + j).className = "tab" + (i === j ? " on" : "")),
  );
}
const API = "https://api.opendota.com/api/";
function apiFetch(url, options = {}) {
 return fetch(url, {...options, signal: options.signal || AbortSignal.timeout(20000)});
}
const MODES = {
  1: "All Pick",
  2: "Captains Mode",
  3: "Random Draft",
  4: "Single Draft",
  5: "All Random",
  16: "Captains Draft",
  18: "Ability Draft",
  22: "All Pick",
  23: "Turbo",
};
let HEROES = null;
function esc(t) {
  return String(t == null ? "" : t).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function msg(t) {
  $("mres").innerHTML = '<div class="msg">' + esc(t) + "</div>";
}
async function loadHeroes() {
  if (HEROES) return HEROES;
  const j = await (await apiFetch(API + "heroes")).json();
  HEROES = {};
  j.forEach((h) => {
    HEROES[h.id] = h.localized_name;
    HN[h.id] = String(h.name || "").replace("npc_dota_hero_", "");
  });
  return HEROES;
}
let ITEMS = null,
  HN = {},
  CUR = null,
  EV = [];
async function loadItems() {
  if (ITEMS) return ITEMS;
  try {
    ITEMS = await (await apiFetch(API + "constants/item_ids")).json();
  } catch (e) {
    ITEMS = {};
  }
  return ITEMS;
}
let matchGeneration = 0;
async function findMatch() {
  const generation = ++matchGeneration;
  const id = $("mid").value.replace(/\D/g, "");
  if (!id) {
    msg("Введите числовой ID матча");
    return;
  }
  msg("Загружаю матч…");
  try {
    const [H, I, C, r] = await Promise.all([
      loadHeroes(),
      loadItems(),
      loadItemC(),
      apiFetch(API + "matches/" + id),
    ]);
    if (generation !== matchGeneration) return;
    if (r.status === 404) {
      msg(
        "Матч не найден. Проверьте ID: возможно, он слишком старый или ещё не попал в базу.",
      );
      return;
    }
    if (!r.ok) throw new Error(r.status);
    const m = await r.json();
    if (!m || m.error || !Array.isArray(m.players) || !m.players.length) {
      msg("Данных по этому матчу нет.");
      return;
    }
    if (generation !== matchGeneration) return;
    showMatch(m, H);
  } catch (e) {
    if (generation !== matchGeneration) return;
    msg(
      "Не удалось загрузить матч. Попробуйте через минуту: у OpenDota есть лимит запросов.",
    );
  }
}
function mmss(s) {
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function fmt(v) {
  return v == null
    ? "–"
    : typeof v === "number"
      ? Math.round(v).toLocaleString("ru-RU")
      : v;
}
function itemImg(id) {
  const k = ITEMS && ITEMS[id];
  return k
    ? '<img class="it" title="' +
        esc(k.replace(/_/g, " ")) +
        '" alt="" src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/' +
        esc(k) +
        '.png" onerror="this.style.visibility=\'hidden\'">'
    : "";
}
function spark(a, c) {
  if (!a || a.length < 2) return "";
  const w = 220,
    h = 44,
    mx = Math.max(1, ...a);
  return (
    '<svg viewBox="0 0 ' +
    w +
    " " +
    h +
    '" width="220" height="44"><polyline fill="none" stroke="' +
    c +
    '" stroke-width="2" points="' +
    a
      .map(
        (v, i) =>
          ((i / (a.length - 1)) * w).toFixed(1) +
          "," +
          (h - (v / mx) * (h - 4) - 2).toFixed(1),
      )
      .join(" ") +
    '"/></svg>'
  );
}
function buildEvents(m, P) {
  const E = [];
  (m.objectives || []).forEach((o) => {
    if (o.type === "building_kill" && o.key) {
      const k = o.key,
        rad = /goodguys/.test(k);
      const kind = /fort/.test(k)
        ? "Трон"
        : /rax/.test(k)
          ? "казармы"
          : /tower/.test(k)
            ? "башня"
            : null;
      if (!kind) return;
      const tier = (k.match(/tower(\d)/) || [])[1],
        lane = /_top/.test(k)
          ? " верх"
          : /_mid/.test(k)
            ? " центр"
            : /_bot/.test(k)
              ? " низ"
              : "";
      E.push({
        t: o.time,
        rad: !rad,
        mk: 1,
        txt:
          (rad ? "Свет" : "Тьма") +
          ": потеряна " +
          kind +
          (tier ? " T" + tier : "") +
          lane,
      });
    } else if (o.type === "CHAT_MESSAGE_ROSHAN_KILL")
      E.push({
        t: o.time,
        rad: o.team === 2,
        mk: 2,
        txt: "Рошан убит (" + (o.team === 2 ? "Свет" : "Тьма") + ")",
      });
    else if (o.type === "CHAT_MESSAGE_AEGIS") {
      const p = P.find((x) => x.player_slot === o.player_slot);
      E.push({
        t: o.time,
        rad: p ? p.rad : true,
        txt: "Эгида подобрана: " + (p ? p.hn : "?"),
      });
    }
  });
  let fb = null;
  P.forEach((p) =>
    (p.kills_log || []).forEach((k) => {
      if (!fb || k.time < fb.t) fb = { t: k.time, p };
    }),
  );
  if (fb) E.push({ t: fb.t, rad: fb.p.rad, txt: "Первая кровь: " + fb.p.hn });
  (m.teamfights || []).forEach((f) => {
    let dr = 0,
      dd = 0;
    (f.players || []).forEach((x, i) => {
      if (P[i]) {
        if (P[i].rad) dr += x.deaths || 0;
        else dd += x.deaths || 0;
      }
    });
    if (dr + dd >= 3)
      E.push({
        t: f.start,
        rad: dd > dr,
        txt:
          "Драка: погибло " +
          dr +
          " у Света и " +
          dd +
          " у Тьмы" +
          (dr === dd ? " (ничья)" : ""),
      });
  });
  return E.sort((a, b) => a.t - b.t);
}
function drawChart(k) {
  const m = CUR;
  if (!m) return;
  $("cg").className = "tab" + (k === "g" ? " on" : "");
  $("cx").className = "tab" + (k === "x" ? " on" : "");
  const a = k === "g" ? m.radiant_gold_adv : m.radiant_xp_adv;
  if (!a || a.length < 2) {
    $("chartbox").innerHTML =
      '<div class="msg">Нет данных по минутам: матч не разобран OpenDota.<br><button class="btn" style="margin-top:10px" onclick="reqParse()">Запросить разбор</button><div id="rq" class="s"></div></div>';
    return;
  }
  const W = 700,
    z = 110,
    mx = Math.max(1, ...a.map(Math.abs)),
    X = (i) => (i / (a.length - 1)) * W,
    Y = (v) => z - (v / mx) * (z - 14);
  const pts = a.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1));
  const area = "M0," + z + " L" + pts.join(" L") + " L" + W + "," + z + " Z";
  const mk = EV.filter((e) => e.mk && e.t >= 0 && e.t / 60 <= a.length - 1)
    .map((e) => {
      const i = e.t / 60;
      return (
        '<circle cx="' +
        X(i).toFixed(1) +
        '" cy="' +
        Y(a[Math.round(i)]).toFixed(1) +
        '" r="' +
        (e.mk === 2 ? 5 : 3) +
        '" fill="' +
        (e.mk === 2 ? "#ffc857" : "#fff") +
        '" stroke="#05080d"><title>' +
        esc(mmss(e.t) + " · " + e.txt) +
        "</title></circle>"
      );
    })
    .join("");
  const last = a[a.length - 1];
  $("chartbox").innerHTML =
    '<div class="s" style="margin-bottom:6px">' +
    (last >= 0 ? "Свет" : "Тьма") +
    " впереди на " +
    fmt(Math.abs(last)) +
    " к " +
    (a.length - 1) +
    '-й минуте</div><div class="sc"><svg viewBox="0 0 700 220" style="width:100%;min-width:520px"><defs><clipPath id="cu"><rect x="0" y="0" width="700" height="' +
    z +
    '"/></clipPath><clipPath id="cd"><rect x="0" y="' +
    z +
    '" width="700" height="' +
    z +
    '"/></clipPath></defs><path d="' +
    area +
    '" fill="#5be3b0" fill-opacity=".35" clip-path="url(#cu)"/><path d="' +
    area +
    '" fill="#ff6b87" fill-opacity=".35" clip-path="url(#cd)"/><line x1="0" x2="700" y1="' +
    z +
    '" y2="' +
    z +
    '" stroke="#2d4d70" stroke-dasharray="4 4"/><polyline points="' +
    pts.join(" ") +
    '" fill="none" stroke="#c9f1ff" stroke-width="2"/>' +
    mk +
    '</svg></div><div class="s">Выше линии — преимущество Сил Света, ниже — Сил Тьмы. Жёлтые точки — Рошан, белые — строения (наведите, чтобы увидеть).</div>';
}
async function reqParse() {
  try {
    const r = await apiFetch(API + "request/" + CUR.match_id, { method: "POST" });
    $("rq").textContent = r.ok
      ? "Запрос отправлен. Подождите 1–3 минуты и нажмите «Найти» снова."
      : "Не удалось отправить запрос (" + r.status + ").";
  } catch (e) {
    $("rq").textContent = "Не удалось отправить запрос.";
  }
}
function showMatch(m, H) {
  const P = m.players.map((p) => ({
    ...p,
    rad: p.isRadiant !== undefined ? p.isRadiant : p.player_slot < 128,
    hn: H[p.hero_id] || "Hero " + p.hero_id,
    nm: p.personaname || p.name || "Аноним",
  }));
  CUR = m;
  EV = buildEvents(m, P);
  const best = (k) =>
    P.reduce((a, b) => ((b[k] || 0) > (a[k] || 0) ? b : a), P[0]);
  const bk = best("kills"),
    bl = best("last_hits"),
    bd = best("denies"),
    bh = best("hero_damage");
  const card = (t, p, v) =>
    (p[v[0]] || 0) > 0
      ? '<div class="card"><div class="k">' +
        t +
        '</div><div class="v pn">' +
        esc(p.nm) +
        '</div><div class="s">' +
        esc(p.hn) +
        " · " +
        fmt(p[v[0]]) +
        " " +
        v[1] +
        "</div></div>"
      : "";
  const av = (p) => {
    const ini = p.hn
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2);
    return (
      '<span class="av">' +
      esc(ini) +
      (HN[p.hero_id]
        ? '<img alt="" src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/' +
          esc(HN[p.hero_id]) +
          '.png" onerror="this.remove()">'
        : "") +
      "</span>"
    );
  };
  const row = (p) =>
    '<tr class="rw" onclick="this.nextElementSibling.classList.toggle(\'open\')"><td><span class="hero">' +
    av(p) +
    '<span class="who"><span class="pn">' +
    esc(p.nm) +
    '</span><span class="hn">' +
    esc(p.hn) +
    "</span></span></span></td><td>" +
    (p.level || "–") +
    "</td>" +
    "<td>" +
    (p.kills || 0) +
    "/" +
    (p.deaths || 0) +
    "/" +
    (p.assists || 0) +
    '</td><td class="' +
    (p === bl ? "mx" : "") +
    '">' +
    (p.last_hits || 0) +
    '</td><td class="' +
    (p === bd ? "mx" : "") +
    '">' +
    (p.denies || 0) +
    "</td>" +
    "<td>" +
    fmt(p.gold_per_min) +
    "</td><td>" +
    fmt(p.xp_per_min) +
    "</td><td>" +
    fmt(p.net_worth) +
    '</td><td class="' +
    (p === bh ? "mx" : "") +
    '">' +
    fmt(p.hero_damage) +
    "</td>" +
    '<td class="itc">' +
    [0, 1, 2, 3, 4, 5].map((i) => itemImg(p["item_" + i])).join("") +
    (p.item_neutral ? itemImg(p.item_neutral) : "") +
    "</td></tr>" +
    '<tr class="dt"><td colspan="10"><div class="dg">' +
    [
      ["Урон по строениям", p.tower_damage],
      ["Лечение", p.hero_healing],
      ["Оглушение, с", p.stuns],
      [
        "Варды обс. / сентри",
        (p.obs_placed || 0) + " / " + (p.sen_placed || 0),
      ],
      ["Золото потрачено", p.gold_spent],
      ["Выкупы", p.buyback_count],
    ]
      .map(
        (x) =>
          '<div><div class="k">' +
          x[0] +
          "</div><b>" +
          fmt(x[1]) +
          "</b></div>",
      )
      .join("") +
    (p.gold_t
      ? '<div><div class="k">Золото по минутам</div>' +
        spark(p.gold_t, "#7fd6ff") +
        "</div>"
      : "") +
    "</div></td></tr>";
  const team = (rad) => {
    const w = m.radiant_win === rad;
    return (
      '<div class="team"><div class="th"><span>' +
      (rad ? "СИЛЫ СВЕТА" : "СИЛЫ ТЬМЫ") +
      '</span><span class="' +
      (w ? "win" : "lose") +
      '">' +
      (w ? "ПОБЕДА" : "ПОРАЖЕНИЕ") +
      " · " +
      (rad ? m.radiant_score : m.dire_score) +
      '</span></div><div class="sc"><table class="mt" style="min-width:860px"><tr><th>Игрок</th><th>Ур.</th><th>K/D/A</th><th>LH</th><th>DN</th><th>GPM</th><th>XPM</th><th>Net</th><th>Урон</th><th>Предметы</th></tr>' +
      P.filter((p) => p.rad === rad)
        .map(row)
        .join("") +
      "</table></div></div>"
    );
  };
  $("mres").innerHTML =
    '<div class="top"><div class="card"><div class="k">Матч ' +
    esc(m.match_id) +
    '</div><div class="v ' +
    (m.radiant_win ? "win" : "lose") +
    '">' +
    (m.radiant_win ? "Победил Свет" : "Победила Тьма") +
    '</div><div class="s">' +
    m.radiant_score +
    " : " +
    m.dire_score +
    " · " +
    mmss(m.duration) +
    '</div><div class="s">' +
    esc(MODES[m.game_mode] || "Режим " + m.game_mode) +
    " · " +
    new Date(m.start_time * 1000).toLocaleString("ru-RU") +
    "</div></div>" +
    card("Больше всего убийств", bk, ["kills", "kills"]) +
    card("Больше всего добитых крипов", bl, ["last_hits", "LH"]) +
    card("Больше всего денаев", bd, ["denies", "DN"]) +
    card("Больше всего урона", bh, ["hero_damage", "урона"]) +
    card("Больше всего лечения", best("hero_healing"), [
      "hero_healing",
      "лечения",
    ]) +
    card("Больше урона по строениям", best("tower_damage"), [
      "tower_damage",
      "урона",
    ]) +
    card("Больше всего вардов", best("obs_placed"), ["obs_placed", "обс."]) +
    "</div>" +
    '<section id="matchAnalysis" class="account-panel"></section><div class="sec"><div class="label">Ход матча</div><div class="tabs"><button class="tab on" id="cg" onclick="drawChart(\'g\')">Золото</button><button class="tab" id="cx" onclick="drawChart(\'x\')">Опыт</button></div><div class="cbox" id="chartbox"></div></div>' +
    (EV.length
      ? '<div class="sec"><div class="label">События матча</div><div class="ev">' +
        EV.map(
          (e) =>
            '<div class="er"><span class="et">' +
            mmss(Math.max(0, e.t)) +
            '</span><span class="dot ' +
            (e.rad ? "dr" : "dd") +
            '"></span>' +
            esc(e.txt) +
            "</div>",
        ).join("") +
        "</div></div>"
      : "") +
    buildSec(P) +
    '<div class="sec"><div class="label">Игроки · нажмите на строку, чтобы раскрыть детали</div>' +
    team(true) +
    team(false) +
    "</div>" +
    '<div class="note">LH — добитые крипы, DN — денаи, GPM/XPM — золото и опыт в минуту, Net — чистая стоимость. Зелёная точка в событиях — выгода Света, красная — Тьмы. Данные: OpenDota; у неразобранных матчей часть полей пустая.</div>';
  drawChart("g");
  window.dispatchEvent(
    new CustomEvent("frostmeta:match", { detail: { match: m, heroes: H } }),
  );
}

const RK = [
  "",
  "Herald",
  "Guardian",
  "Crusader",
  "Archon",
  "Legend",
  "Ancient",
  "Divine",
  "Immortal",
];
function rankTxt(t) {
  if (!t) return "ранг неизвестен";
  const a = Math.floor(t / 10),
    b = t % 10;
  return (RK[a] || "?") + (a < 8 && b ? " " + b : "");
}
function pmsg(t) {
  $("pres").innerHTML = '<div class="msg">' + esc(t) + "</div>";
}
function avId(id, n) {
  const ini = n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    '<span class="av">' +
    esc(ini) +
    (HN[id]
      ? '<img alt="" src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/' +
        esc(HN[id]) +
        '.png" onerror="this.remove()">'
      : "") +
    "</span>"
  );
}
function parseId(input) {
  let text = String(input || "").trim();
  if (!/^\d+$/.test(text)) {
    try {
      const url = new URL(text.includes("://") ? text : "https://" + text);
      if (!["https:", "http:"].includes(url.protocol)) return null;
      const host = url.hostname.replace(/^www\./, "");
      if (
        host === "steamcommunity.com" &&
        /^\/id\/[^/]+\/?$/.test(url.pathname)
      )
        return "vanity";
      const match =
        host === "steamcommunity.com"
          ? url.pathname.match(/^\/profiles\/(\d+)\/?$/)
          : ["dotabuff.com", "opendota.com"].includes(host)
            ? url.pathname.match(/^\/players\/(\d+)\/?$/)
            : null;
      if (!match) return null;
      text = match[1];
    } catch {
      return null;
    }
  }
  let id = BigInt(text);
  if (id >= 76561197960265728n) id -= 76561197960265728n;
  return id > 0n && id <= 4294967295n ? String(id) : null;
}
function openMatch(id) {
  view(1);
  $("mid").value = id;
  findMatch();
}
async function findPlayer() {
  const t = $("pid").value;
  if (!t.trim()) {
    pmsg("Введите Steam ID, ссылку на профиль или ник");
    return;
  }
  const id = parseId(t);
  if (id === "vanity") {
    pmsg(
      "Короткие ссылки steamcommunity.com/id/… не поддерживаются. Используйте числовой ID или введите ник.",
    );
    return;
  }
  if (id) return loadPlayer(id);
  pmsg("Ищу игрока…");
  try {
    const r = await (
      await apiFetch(API + "search?q=" + encodeURIComponent(t.trim()))
    ).json();
    if (!r || !r.length) {
      pmsg("Никого не найдено. Попробуйте числовой ID.");
      return;
    }
    $("pres").innerHTML =
      '<div class="label">Найдено по нику — выберите игрока</div><div class="top">' +
      r
        .slice(0, 9)
        .map(
          (x) =>
            '<div class="card pick" onclick="loadPlayer(\'' +
            esc(x.account_id) +
            '\')"><div class="v pn">' +
            esc(x.personaname) +
            '</div><div class="s">ID ' +
            esc(x.account_id) +
            "</div></div>",
        )
        .join("") +
      "</div>";
  } catch (e) {
    pmsg("Не удалось выполнить поиск. Попробуйте позже.");
  }
}
async function loadPlayer(id) {
  pmsg("Загружаю профиль…");
  try {
    const H = await loadHeroes();
    const g = (u) =>
      apiFetch(API + "players/" + id + u)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const [pr, wl, rm, hs] = await Promise.all([
      g(""),
      g("/wl"),
      g("/recentMatches"),
      g("/heroes"),
    ]);
    if (!pr || !pr.profile) {
      pmsg("Профиль не найден. Проверьте ID.");
      return;
    }
    const pf = pr.profile,
      win = wl ? wl.win : 0,
      lose = wl ? wl.lose : 0,
      tot = win + lose,
      wrp = tot ? ((win / tot) * 100).toFixed(1) : "–";
    const url =
      pf.profileurl && /^https:\/\/steamcommunity\.com\//.test(pf.profileurl)
        ? pf.profileurl
        : null;
    const th = (hs || []).filter((x) => x.games > 0).slice(0, 8);
    const rr = (rm || [])
      .map((x) => {
        const n = H[x.hero_id] || "Hero " + x.hero_id,
          w = x.player_slot < 128 === x.radiant_win;
        return (
          '<tr class="rw" onclick="openMatch(\'' +
          esc(x.match_id) +
          '\')"><td><span class="hero">' +
          avId(x.hero_id, n) +
          '<span class="pn">' +
          esc(n) +
          '</span></span></td><td class="' +
          (w ? "win" : "lose") +
          '">' +
          (w ? "Победа" : "Поражение") +
          "</td><td>" +
          x.kills +
          "/" +
          x.deaths +
          "/" +
          x.assists +
          "</td><td>" +
          mmss(x.duration) +
          "</td><td>" +
          esc(MODES[x.game_mode] || "Режим " + x.game_mode) +
          "</td><td>" +
          new Date(x.start_time * 1000).toLocaleDateString("ru-RU") +
          "</td></tr>"
        );
      })
      .join("");
    $("pres").innerHTML =
      '<div class="card phead">' +
      (pf.avatarfull
        ? '<img class="pav" alt="" src="' +
          esc(pf.avatarfull) +
          '" onerror="this.remove()">'
        : "") +
      '<div><div class="pname">' +
      esc(pf.personaname || "Аноним") +
      '</div><div class="s">ID ' +
      esc(id) +
      " · " +
      esc(rankTxt(pr.rank_tier)) +
      (url
        ? ' · <a href="' +
          esc(url) +
          '" target="_blank" rel="noopener">Steam</a>'
        : "") +
      '</div></div><div class="pst"><div class="k">Победы / поражения</div><div class="v"><span class="win">' +
      win +
      '</span> / <span class="lose">' +
      lose +
      '</span></div><div class="s">Винрейт ' +
      wrp +
      "%</div></div></div>" +
      (th.length
        ? '<div class="sec"><div class="label">Любимые герои · нажмите на героя, чтобы увидеть графики</div><div class="team"><div class="sc"><table class="mt" style="min-width:420px"><tr><th>Герой</th><th>Игры</th><th>Победы</th><th>Винрейт</th></tr>' +
          th
            .map((x) => {
              const n = H[x.hero_id] || "Hero " + x.hero_id;
              return (
                '<tr class="rw" onclick="heroDetail(\'' +
                esc(id) +
                "'," +
                +x.hero_id +
                ')"><td><span class="hero">' +
                avId(x.hero_id, n) +
                '<span class="pn">' +
                esc(n) +
                "</span></span></td><td>" +
                x.games +
                "</td><td>" +
                x.win +
                "</td><td>" +
                ((x.win / x.games) * 100).toFixed(1) +
                "%</td></tr>"
              );
            })
            .join("") +
          "</table></div></div></div>"
        : "") +
      '<div id="hdet"></div><div class="sec"><div class="label">Последние матчи · нажмите, чтобы открыть разбор</div>' +
      (rr
        ? '<div class="team"><div class="sc"><table class="mt" style="min-width:520px"><tr><th>Герой</th><th>Итог</th><th>K/D/A</th><th>Время</th><th>Режим</th><th>Дата</th></tr>' +
          rr +
          "</table></div></div>"
        : '<div class="msg">История матчей скрыта настройками профиля (Expose Public Match Data) или пуста.</div>') +
      "</div>";
  } catch (e) {
    pmsg(
      "Не удалось загрузить профиль. Попробуйте через минуту: у OpenDota есть лимит запросов.",
    );
  }
}
let ICONS = null;
async function loadItemC() {
  if (ICONS) return ICONS;
  try {
    ICONS = await (await apiFetch(API + "constants/items")).json();
  } catch (e) {
    ICONS = {};
  }
  return ICONS;
}
function buildTimes(p) {
  const C = ICONS || {},
    log = p.purchase_log || [],
    first = {},
    seen = {},
    out = [];
  const ok = (k) => {
    const c = C[k];
    return c && c.components && c.cost >= 1000 && !/^recipe_/.test(k);
  };
  log.forEach((x) => {
    if (first[x.key] == null) first[x.key] = x.time;
    if (ok(x.key)) {
      out.push({ k: x.key, t: x.time });
      seen[x.key] = 1;
    }
  });
  const tm = (k, d) => {
    if (first[k] != null) return first[k];
    const c = C[k];
    if (!c || !c.components || d > 4) return null;
    const ts = c.components
      .concat(["recipe_" + k])
      .map((x) => tm(x, d + 1))
      .filter((n) => n != null);
    return ts.length ? Math.max(...ts) : null;
  };
  [0, 1, 2, 3, 4, 5].forEach((i) => {
    const k = ITEMS && ITEMS[p["item_" + i]];
    if (!k || seen[k] || !ok(k)) return;
    const t = tm(k, 0);
    if (t != null) {
      out.push({ k, t, est: 1 });
      seen[k] = 1;
    }
  });
  return out.sort((a, b) => a.t - b.t);
}
function buildSec(P) {
  if (!P.some((p) => p.purchase_log && p.purchase_log.length))
    return '<div class="sec"><div class="label">Сборка предметов</div><div class="msg">Нужен разобранный матч: у OpenDota пока нет журнала покупок.</div></div>';
  const chip = (x) => {
    const c = ICONS[x.k] || {};
    return (
      '<span class="chip"><img class="it" alt="" src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/' +
      esc(x.k) +
      '.png" onerror="this.style.visibility=\'hidden\'">' +
      esc(c.dname || x.k.replace(/_/g, " ")) +
      " <b>" +
      (x.est ? "~" : "") +
      mmss(Math.max(0, x.t)) +
      "</b></span>"
    );
  };
  const one = (p) => {
    const l = buildTimes(p);
    return (
      '<div class="bp"><div><span class="pn">' +
      esc(p.nm) +
      '</span> <span class="hn">' +
      esc(p.hn) +
      '</span></div><div class="chips">' +
      (l.length
        ? l.map(chip).join("")
        : '<span class="hn">нет крупных предметов</span>') +
      "</div></div>"
    );
  };
  return (
    '<div class="sec"><div class="label">Сборка предметов · время появления</div>' +
    [true, false]
      .map(
        (r) =>
          '<div class="team"><div class="th"><span>' +
          (r ? "СИЛЫ СВЕТА" : "СИЛЫ ТЬМЫ") +
          "</span></div>" +
          P.filter((p) => p.rad === r)
            .map(one)
            .join("") +
          "</div>",
      )
      .join("") +
    '<div class="s" style="margin-top:8px">Показаны собранные предметы дороже 1000 золота. «~» — время приблизительное (по последней купленной части).</div></div>'
  );
}

function nf(v) {
  return v == null || isNaN(v)
    ? "–"
    : v >= 100
      ? Math.round(v).toLocaleString("ru-RU")
      : v.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}
function movAvg(a, w) {
  return a.map((_, i) => {
    const t = a.slice(Math.max(0, i - w + 1), i + 1);
    return t.reduce((x, y) => x + y, 0) / t.length;
  });
}
const isW = (m) => m.player_slot < 128 === m.radiant_win;
function lineSvg(raw, avg, o, L) {
  const W = 700,
    Ht = 210,
    pl = 42,
    pr = 10,
    pt = 12,
    pb = 22,
    n = avg.length,
    all = (raw || []).concat(avg);
  let mn = o.min != null ? o.min : Math.min(...all),
    mx = o.max != null ? o.max : Math.max(...all);
  if (mx === mn) {
    mx += 1;
    mn -= 1;
  }
  const X = (i) =>
      pl + (n < 2 ? (W - pl - pr) / 2 : (i / (n - 1)) * (W - pl - pr)),
    Y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (Ht - pt - pb);
  const tip = (i) =>
    new Date(L[i].start_time * 1000).toLocaleDateString("ru-RU") +
    " · " +
    (isW(L[i]) ? "победа" : "поражение") +
    " · " +
    (raw ? raw[i] : avg[i]).toFixed(o.d);
  const dots = (raw || avg)
    .map(
      (v, i) =>
        '<circle cx="' +
        X(i).toFixed(1) +
        '" cy="' +
        Y(v).toFixed(1) +
        '" r="' +
        (raw ? 3 : 2.5) +
        '" fill="' +
        (raw ? "#7c94ab" : "#c9f1ff") +
        '" opacity="' +
        (raw ? ".75" : "1") +
        '" style="cursor:pointer" onclick="openMatch(\'' +
        esc(L[i].match_id) +
        "')\"><title>" +
        esc(tip(i)) +
        "</title></circle>",
    )
    .join("");
  const grid = [mn, (mn + mx) / 2, mx]
    .map(
      (v) =>
        '<line x1="' +
        pl +
        '" x2="' +
        (W - pr) +
        '" y1="' +
        Y(v).toFixed(1) +
        '" y2="' +
        Y(v).toFixed(1) +
        '" stroke="#1b2c42"/><text x="' +
        (pl - 6) +
        '" y="' +
        (Y(v) + 4).toFixed(1) +
        '" text-anchor="end" fill="#7c94ab" font-size="11">' +
        v.toFixed(o.d) +
        (o.u || "") +
        "</text>",
    )
    .join("");
  const ref =
    o.ref != null
      ? '<line x1="' +
        pl +
        '" x2="' +
        (W - pr) +
        '" y1="' +
        Y(o.ref).toFixed(1) +
        '" y2="' +
        Y(o.ref).toFixed(1) +
        '" stroke="#2d4d70" stroke-dasharray="4 4"/>'
      : "";
  return (
    '<svg viewBox="0 0 700 210" style="width:100%;min-width:520px">' +
    grid +
    ref +
    '<polyline fill="none" stroke="#7fd6ff" stroke-width="2.5" points="' +
    avg.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ") +
    '"/>' +
    dots +
    '<text x="' +
    pl +
    '" y="207" fill="#7c94ab" font-size="11">старые игры</text><text x="' +
    (W - pr) +
    '" y="207" text-anchor="end" fill="#7c94ab" font-size="11">последние</text></svg>'
  );
}
let HD = null;
async function heroDetail(id, hid) {
  const box = $("hdet");
  box.innerHTML = '<div class="msg">Загружаю матчи на герое…</div>';
  try {
    const H = await loadHeroes();
    const fl = [
      "match_id",
      "player_slot",
      "radiant_win",
      "start_time",
      "duration",
      "kills",
      "deaths",
      "assists",
      "gold_per_min",
      "xp_per_min",
      "last_hits",
      "hero_damage",
    ];
    const r = await fetch(
      API +
        "players/" +
        id +
        "/matches?hero_id=" +
        hid +
        "&limit=100&" +
        fl.map((f) => "project=" + f).join("&"),
    );
    if (!r.ok) throw new Error(r.status);
    const L = (await r.json()).sort((a, b) => a.start_time - b.start_time);
    if (!L.length) {
      box.innerHTML =
        '<div class="msg">Матчей на этом герое в открытой истории нет.</div>';
      return;
    }
    HD = { L, name: H[hid] || "Hero " + hid };
    drawHero("w");
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    box.innerHTML =
      '<div class="msg">Не удалось загрузить матчи на этом герое. Попробуйте позже.</div>';
  }
}
function drawHero(k) {
  const { L, name } = HD,
    mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1),
    wins = L.filter(isW).length;
  const kda = L.map(
      (m) => ((m.kills || 0) + (m.assists || 0)) / Math.max(1, m.deaths || 0),
    ),
    gpm = L.map((m) => m.gold_per_min || 0),
    xpm = L.map((m) => m.xp_per_min || 0);
  const wr = L.map((m, i) => {
    const t = L.slice(Math.max(0, i - 9), i + 1);
    return (t.filter(isW).length / t.length) * 100;
  });
  const C = {
    w: [
      null,
      wr,
      { min: 0, max: 100, ref: 50, d: 0, u: "%" },
      "Винрейт: скользящее окно по 10 играм",
    ],
    k: [
      kda,
      movAvg(kda, 5),
      { d: 1 },
      "KDA (убийства + помощь) / смерти. Линия — среднее за 5 игр",
    ],
    g: [
      gpm,
      movAvg(gpm, 5),
      { d: 0 },
      "Золото в минуту. Линия — среднее за 5 игр",
    ],
    x: [
      xpm,
      movAvg(xpm, 5),
      { d: 0 },
      "Опыт в минуту. Линия — среднее за 5 игр",
    ],
  }[k];
  const bi = kda.indexOf(Math.max(...kda)),
    bm = L[bi];
  const card = (t, v, s) =>
    '<div class="card"><div class="k">' +
    t +
    '</div><div class="v">' +
    v +
    '</div><div class="s">' +
    s +
    "</div></div>";
  const tb = [
    ["w", "Винрейт"],
    ["k", "KDA"],
    ["g", "GPM"],
    ["x", "XPM"],
  ]
    .map(
      (x) =>
        '<button class="tab' +
        (x[0] === k ? " on" : "") +
        '" onclick="drawHero(\'' +
        x[0] +
        "')\">" +
        x[1] +
        "</button>",
    )
    .join("");
  const empty = k !== "w" && !C[0].some((v) => v > 0);
  $("hdet").innerHTML =
    '<div class="sec"><div class="label">' +
    esc(name) +
    " · последние " +
    L.length +
    ' игр</div><div class="top">' +
    card(
      "Матчей / побед",
      L.length + " / " + wins,
      "винрейт " + nf((wins / L.length) * 100) + "%",
    ) +
    card(
      "Средний KDA",
      nf(mean(kda)),
      nf(mean(L.map((m) => m.kills || 0))) +
        " / " +
        nf(mean(L.map((m) => m.deaths || 0))) +
        " / " +
        nf(mean(L.map((m) => m.assists || 0))),
    ) +
    card(
      "Средний GPM / XPM",
      nf(mean(gpm)) + " / " + nf(mean(xpm)),
      "LH " + nf(mean(L.map((m) => m.last_hits || 0))),
    ) +
    '<div class="card pick" onclick="openMatch(\'' +
    esc(bm.match_id) +
    '\')"><div class="k">Лучший матч по KDA</div><div class="v">' +
    nf(kda[bi]) +
    '</div><div class="s">' +
    bm.kills +
    "/" +
    bm.deaths +
    "/" +
    bm.assists +
    " · " +
    (isW(bm) ? "победа" : "поражение") +
    " · открыть</div></div></div>" +
    '<div class="tabs" style="margin-top:14px">' +
    tb +
    '</div><div class="cbox"><div class="s" style="margin-bottom:6px">' +
    C[3] +
    "</div>" +
    (empty
      ? '<div class="msg">OpenDota не отдал эти данные для матчей игрока.</div>'
      : '<div class="sc">' + lineSvg(C[0], C[1], C[2], L) + "</div>") +
    '<div class="s">Наведите на точку: дата и результат. Клик по точке открывает матч.</div></div></div>';
}
async function resolveId(t) {
  const id = parseId(t);
  if (id === "vanity") throw "vanity";
  if (id) return id;
  const r = await (
    await apiFetch(API + "search?q=" + encodeURIComponent(t.trim()))
  ).json();
  if (!r || !r.length) throw "none";
  return String(r[0].account_id);
}
function fetchP(id) {
  const g = (u) =>
    apiFetch(API + "players/" + id + u)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  return Promise.all([
    g(""),
    g("/wl"),
    g("/totals"),
    g("/heroes"),
    g("/peers"),
  ]).then(([pr, wl, tt, hs, pe]) => ({ id, pr, wl, tt, hs, pe }));
}
function cmsg(t) {
  $("cres").innerHTML = '<div class="msg">' + esc(t) + "</div>";
}
async function compare() {
  const a = $("ca").value.trim(),
    b = $("cb").value.trim();
  if (!a || !b) {
    cmsg("Введите двух игроков");
    return;
  }
  cmsg("Загружаю данные…");
  try {
    const H = await loadHeroes();
    const [ia, ib] = await Promise.all([resolveId(a), resolveId(b)]);
    const [A, B] = await Promise.all([fetchP(ia), fetchP(ib)]);
    if (!A.pr || !A.pr.profile || !B.pr || !B.pr.profile) {
      cmsg("Один из профилей не найден. Проверьте ID.");
      return;
    }
    renderCmp(A, B, H);
  } catch (e) {
    cmsg(
      e === "vanity"
        ? "Короткие ссылки steamcommunity.com/id/… не поддерживаются: используйте числовой ID или ник."
        : e === "none"
          ? "Игрок по нику не найден."
          : "Не удалось загрузить данные. Попробуйте через минуту: у OpenDota есть лимит запросов.",
    );
  }
}
function renderCmp(A, B, H) {
  const av = (x, f) => {
    const t = (x.tt || []).find((q) => q.field === f);
    return t && t.n ? t.sum / t.n : null;
  };
  const wr = (x) => {
    const t = x.wl ? x.wl.win + x.wl.lose : 0;
    return t ? (x.wl.win / t) * 100 : null;
  };
  const kda = (x) => {
    const d = av(x, "deaths");
    return d ? (av(x, "kills") + av(x, "assists")) / d : null;
  };
  const M = [
    ["Матчей", (x) => (x.wl ? x.wl.win + x.wl.lose : null), 1],
    ["Винрейт, %", wr, 1],
    ["Убийства", (x) => av(x, "kills"), 1],
    ["Смерти", (x) => av(x, "deaths"), -1],
    ["Помощь", (x) => av(x, "assists"), 1],
    ["KDA", kda, 1],
    ["GPM", (x) => av(x, "gold_per_min"), 1],
    ["XPM", (x) => av(x, "xp_per_min"), 1],
    ["Добитые крипы", (x) => av(x, "last_hits"), 1],
    ["Денаи", (x) => av(x, "denies"), 1],
    ["Урон по героям", (x) => av(x, "hero_damage"), 1],
    ["Лечение", (x) => av(x, "hero_healing"), 1],
    ["Урон по строениям", (x) => av(x, "tower_damage"), 1],
  ];
  const pf = (x) => x.pr.profile,
    nm = (x) => esc(pf(x).personaname || "Аноним");
  const head = (x) => {
    const w = x.wl ? x.wl.win : 0,
      l = x.wl ? x.wl.lose : 0;
    return (
      '<div class="card phead" style="margin-top:0">' +
      (pf(x).avatarfull
        ? '<img class="pav" style="width:56px;height:56px" alt="" src="' +
          esc(pf(x).avatarfull) +
          '" onerror="this.remove()">'
        : "") +
      '<div><div class="pname" style="font-size:20px">' +
      nm(x) +
      '</div><div class="s">ID ' +
      esc(x.id) +
      " · " +
      esc(rankTxt(x.pr.rank_tier)) +
      '</div><div class="s"><span class="win">' +
      w +
      '</span> / <span class="lose">' +
      l +
      "</span></div></div></div>"
    );
  };
  const rows = M.map(([lb, f, dir]) => {
    const va = f(A),
      vb = f(B),
      t = (va || 0) + (vb || 0),
      pa = t ? (va / t) * 100 : 50;
    const wa =
      va != null && vb != null && va !== vb ? va > vb === dir > 0 : null;
    return (
      '<div class="cr"><div class="cv' +
      (wa === true ? " w" : "") +
      '">' +
      nf(va) +
      '</div><div><div class="cl">' +
      lb +
      '</div><div class="cb"><i style="width:' +
      pa.toFixed(1) +
      '%"></i></div></div><div class="cv r' +
      (wa === false ? " w" : "") +
      '">' +
      nf(vb) +
      "</div></div>"
    );
  }).join("");
  const top = (x) =>
    (x.hs || [])
      .filter((h) => h.games > 0)
      .slice(0, 5)
      .map((h) => {
        const n = H[h.hero_id] || "Hero " + h.hero_id;
        return (
          '<div class="hr"><span class="hero">' +
          avId(h.hero_id, n) +
          '<span class="pn">' +
          esc(n) +
          "</span></span><span>" +
          h.games +
          " игр · " +
          nf((h.win / h.games) * 100) +
          "%</span></div>"
        );
      })
      .join("") || '<div class="msg">нет данных</div>';
  const mapA = new Map((A.hs || []).map((h) => [h.hero_id, h]));
  const common = (B.hs || [])
    .filter(
      (h) =>
        h.games >= 3 && mapA.has(h.hero_id) && mapA.get(h.hero_id).games >= 3,
    )
    .sort(
      (p, q) =>
        Math.min(q.games, mapA.get(q.hero_id).games) -
        Math.min(p.games, mapA.get(p.hero_id).games),
    )
    .slice(0, 8);
  const cm = common.length
    ? '<div class="sec"><div class="label">Общие герои (от 3 игр у каждого)</div><div class="team"><div class="sc"><table class="mt" style="min-width:460px"><tr><th>Герой</th><th>' +
      nm(A) +
      "</th><th>" +
      nm(B) +
      "</th></tr>" +
      common
        .map((h) => {
          const a = mapA.get(h.hero_id),
            n = H[h.hero_id] || "Hero " + h.hero_id,
            wa = a.win / a.games,
            wb = h.win / h.games;
          return (
            '<tr><td><span class="hero">' +
            avId(h.hero_id, n) +
            '<span class="pn">' +
            esc(n) +
            '</span></span></td><td class="' +
            (wa > wb ? "mx" : "") +
            '">' +
            a.games +
            " игр · " +
            nf(wa * 100) +
            '%</td><td class="' +
            (wb > wa ? "mx" : "") +
            '">' +
            h.games +
            " игр · " +
            nf(wb * 100) +
            "%</td></tr>"
          );
        })
        .join("") +
      "</table></div></div></div>"
    : "";
  const pe = (A.pe || []).find((x) => String(x.account_id) === String(B.id));
  const tg = pe
    ? '<div class="two"><div class="card"><div class="k">Играли вместе</div><div class="v">' +
      pe.with_games +
      ' игр</div><div class="s">побед ' +
      pe.with_win +
      " · винрейт " +
      nf(pe.with_games ? (pe.with_win / pe.with_games) * 100 : 0) +
      '%</div></div><div class="card"><div class="k">Друг против друга</div><div class="v">' +
      pe.against_games +
      ' игр</div><div class="s">' +
      nm(A) +
      " выиграл " +
      pe.against_win +
      " · " +
      nm(B) +
      " " +
      (pe.against_games - pe.against_win) +
      "</div></div></div>"
    : '<div class="msg">В публичной истории эти игроки вместе и друг против друга не встречались.</div>';
  $("cres").innerHTML =
    '<div class="two">' +
    head(A) +
    head(B) +
    '</div><div class="sec"><div class="label">Средние показатели за матч · ярче значение лучшего</div><div class="team">' +
    rows +
    "</div></div>" +
    '<div class="sec"><div class="label">Любимые герои</div><div class="two"><div class="team"><div class="th"><span>' +
    nm(A) +
    "</span></div>" +
    top(A) +
    '</div><div class="team"><div class="th"><span>' +
    nm(B) +
    "</span></div>" +
    top(B) +
    "</div></div></div>" +
    cm +
    '<div class="sec"><div class="label">Встречи между игроками</div>' +
    tg +
    "</div>";
}
document.addEventListener("DOMContentLoaded", () => {
  $("mid").addEventListener("keydown", (e) => {
    if (e.key === "Enter") findMatch();
  });
  $("pid").addEventListener("keydown", (e) => {
    if (e.key === "Enter") findPlayer();
  });
  ["ca", "cb"].forEach((i) =>
    $(i).addEventListener("keydown", (e) => {
      if (e.key === "Enter") compare();
    }),
  );
});

if (
  !window.Capacitor?.isNativePlatform() &&
  "serviceWorker" in navigator &&
  (location.protocol === "https:" || location.hostname === "localhost")
) {
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .catch(() => {}),
  );
}
