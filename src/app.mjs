import { Capacitor } from "@capacitor/core";
import { initInsights } from "./hero-insights.mjs";
import { App } from "@capacitor/app";
const $ = (id) => document.getElementById(id),
  native = Capacitor.isNativePlatform();
if (native) document.body.classList.add("native");
let config = {},
  toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 7000);
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function action(parent, label, fn, cls = "quiet") {
  const b = el("button", label, cls);
  b.onclick = async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      b.disabled = false;
    }
  };
  parent.append(b);
  return b;
}
async function me() {
  const box = $("accountPanel");
  box.replaceChildren(el("h2", "Мой профиль Dota 2"));
  box.append(
    el(
      "p",
      "Сохрани Dota ID или числовую ссылку Steam на этом устройстве. Вход и подтверждение владения аккаунтом не требуются.",
    ),
  );
  const input = el("input");
  input.id = "localDotaId";
  input.placeholder = "Dota ID или ссылка Steam /profiles/…";
  input.setAttribute("aria-label", "Dota ID или ссылка Steam");
  box.append(input);
  let saved = null;
  try {
    saved = localStorage.getItem("frostmeta.dotaId");
  } catch {}
  if (saved) input.value = saved;
  const valid = () => {
    const id = window.parseId(input.value.trim());
    if (!id || !/^[1-9]\d*$/.test(id) || BigInt(id) > 4294967295n)
      throw Error(
        "Введи Dota ID от 1 до 4294967295 или числовую ссылку Steam. Поиск по нику доступен во вкладке «Игрок».",
      );
    return id;
  };
  const actions = el("div", null, "account-actions");
  box.append(actions);
  action(
    actions,
    "Сохранить профиль",
    async () => {
      const id = valid();
      localStorage.setItem("frostmeta.dotaId", id);
      toast("Профиль сохранён на этом устройстве");
    },
    "btn",
  );
  action(actions, "Открыть статистику", async () => {
    const id = valid();
    window.view(2);
    $("pid").value = id;
    window.loadPlayer(id);
    box.hidden = true;
  });
  action(actions, "Удалить сохранённый ID", async () => {
    localStorage.removeItem("frostmeta.dotaId");
    input.value = "";
    toast("Сохранённый ID удалён");
  });
  box.append(
    el(
      "p",
      "История матчей зависит от настройки публичности в Dota 2. Сохранённый ID не синхронизируется между устройствами.",
      "small-note",
    ),
  );
}
if (native)
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) refreshMeta();
  });
initInsights();
$("accountButton").onclick = () => {
  $("accountPanel").hidden = !$("accountPanel").hidden;
};
$("downloadApp").onclick = () => $("downloadDialog").showModal();
$("closeDownload").onclick = () => $("downloadDialog").close();
function stores() {
  const root = $("storeLinks");
  for (const [key, label, waiting] of [
    ["googlePlayUrl", "Google Play", "Android · скоро"],
    ["appStoreUrl", "App Store", "iPhone · скоро"],
    ["androidApkUrl", "Скачать APK", "Тестовая версия Android"],
  ]) {
    const url = safeUrl(config[key]);
    if (key === "androidApkUrl" && !url) continue;
    const item = el(url ? "a" : "div", null, "store");
    item.append(
      el("b", label),
      el("span", url ? "Скачать приложение" : waiting),
    );
    if (url) {
      item.href = url;
      item.target = "_blank";
      item.rel = "noopener";
    } else item.setAttribute("aria-disabled", "true");
    root.append(item);
  }
}
function date(value) {
  const d = new Date(value);
  return Number.isNaN(+d)
    ? "неизвестно"
    : d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}
async function checkMetaHealth() {
  try {
    const source =
      native && safeUrl(config.metaUrl)
        ? new URL("meta-status.json", config.metaUrl)
        : new URL("./meta-status.json", location.href);
    const r = await fetch(source, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return;
    const status = await r.json();
    if (status.ok === false) {
      $("metaStatus").classList.add("stale");
      $("metaStatus")
        .querySelector("span")
        .replaceChildren(
          el("strong", "Источник временно не обновляется"),
          document.createTextNode(
            " · последняя попытка " + date(status.checkedAt),
          ),
        );
      $("note").textContent += " · сохранена предыдущая статистика";
    }
  } catch {}
}
let loading = false;
async function refreshMeta() {
  if (loading) return;
  loading = true;
  $("refreshMeta").disabled = true;
  try {
    let offline = false;
    let r;
    try {
      r = await fetch(
        native
          ? safeUrl(config.metaUrl) || new URL("./data.json", location.href)
          : new URL("./data.json", location.href),
        { cache: "no-store", signal: AbortSignal.timeout(12000) },
      );
      if (!r.ok) throw Error();
    } catch (e) {
      if (!native) throw e;
      offline = true;
      r = await fetch("./data.json");
    }
    const j = await r.json();
    if (!Array.isArray(j.ranks) || !Array.isArray(j.roles) || !j.data)
      throw Error();
    window.applyMeta(j);
    const stamp = j.dataUpdatedAt || j.updated,
      age = Date.now() - new Date(stamp).getTime();
    const stale =
      offline || j.demo || !Number.isFinite(age) || age > 48 * 3600000;
    const state = $("metaStatus");
    state.classList.toggle("stale", Boolean(stale));
    const span = state.querySelector("span");
    span.replaceChildren(
      el(
        "strong",
        offline
          ? "Сохранённая статистика · нет связи"
          : j.demo
            ? "Демо-данные"
            : stale
              ? "Данные требуют обновления"
              : "Статистика загружена",
      ),
      document.createTextNode(" · " + date(stamp)),
    );
    $("note").textContent = j.demo
      ? "Демонстрационные данные."
      : `STRATZ · ${j.sourceWindow === "day" ? "суточная" : "недельная"} выборка · проверено ${date(j.checkedAt || j.updated)}${j.unchanged ? " · источник пока возвращает прежние цифры" : ""}${j.failedSlices?.length ? " · часть фильтров содержит предыдущие данные" : ""} · тренд к предыдущему обновлению`;
    checkMetaHealth();
  } catch {
    $("metaStatus").classList.add("stale");
    $("metaStatus").querySelector("span").textContent =
      "Не удалось проверить обновления. Проверь подключение.";
    if (!$("list").children.length)
      $("list").append(
        el(
          "div",
          "Не удалось загрузить статистику. Нажми «Обновить», чтобы повторить.",
          "empty",
        ),
      );
  } finally {
    loading = false;
    $("refreshMeta").disabled = false;
  }
}
$("refreshMeta").onclick = refreshMeta;
try {
  const r = await fetch("./app-config.json", { cache: "no-store" });
  config = await r.json();
  if (config.apiBase) config.apiBase = config.apiBase.replace(/\/$/, "");
} catch {}

stores();
await Promise.all([me(), refreshMeta()]);
if (new URLSearchParams(location.search).has("account")) {
  $("accountPanel").hidden = false;
  history.replaceState(null, "", location.pathname);
}
setInterval(() => {
  if (!document.hidden) refreshMeta();
}, 5 * 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshMeta();
});
