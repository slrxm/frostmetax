import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
const $ = (id) => document.getElementById(id),
  native = Capacitor.isNativePlatform();
if (native) document.body.classList.add("native");
let config = {},
  user = null,
  bearer = null,
  pending = null,
  googleConfigured = false,
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
async function api(path, { method = "GET", body } = {}) {
  if (native && !config.apiBase)
    throw Error("Сервис авторизации ещё не подключён");
  const r = await fetch((config.apiBase || "") + path, {
    method,
    credentials: native ? "omit" : "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(data.error || "Сервис временно недоступен");
  return { data, status: r.status };
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
async function account() {
  const box = $("accountPanel");
  box.replaceChildren();
  box.append(el("h2", user ? "Твой FROSTMETA" : "Твой профиль Dota 2"));
  if (!user) {
    box.append(
      el(
        "p",
        "Войди через Google и привяжи Steam. Твой профиль и последние матчи будут под рукой.",
      ),
    );
    const b = action(box, "Войти через Google", () => login("google"), "btn");
    b.disabled = !googleConfigured;
    if (!googleConfigured)
      box.append(
        el(
          "p",
          "Вход появится после подключения сервиса авторизации. Поиск игроков и матчей уже доступен без аккаунта.",
          "small-note",
        ),
      );
    return;
  }
  box.append(el("p", `${user.name} · ${user.email}`, "account-email"));
  const row = el("div", null, "account-actions");
  box.append(row);
  if (user.accountId) {
    box.append(el("p", `Steam привязан · Dota ID ${user.accountId}`));
    action(
      row,
      "Открыть мой профиль Dota 2",
      () => {
        window.view(2);
        $("pid").value = user.accountId;
        window.loadPlayer(user.accountId);
        box.hidden = true;
      },
      "btn",
    );
    action(row, "Отвязать Steam", async () => {
      if (!confirm("Отвязать профиль Steam?")) return;
      await api("/api/steam", { method: "DELETE" });
      await me();
    });
  } else {
    box.append(
      el(
        "p",
        "Подтверди свой профиль на официальном сайте Steam. Пароль Steam в приложение не передаётся.",
      ),
    );
    action(row, "Привязать Steam", () => login("steam"), "btn");
  }
  action(row, "Выйти", async () => {
    await api("/api/logout", { method: "POST" });
    bearer = null;
    await me();
  });
  action(
    row,
    "Удалить аккаунт",
    async () => {
      if (
        !confirm(
          "Удалить аккаунт FROSTMETA и привязку Steam? Это действие необратимо.",
        )
      )
        return;
      await api("/api/account", { method: "DELETE" });
      bearer = null;
      await me();
    },
    "quiet danger",
  );
  box.append(
    el(
      "p",
      "История матчей доступна, если в Dota 2 включена настройка «Общедоступная история матчей».",
      "small-note",
    ),
  );
}
async function me() {
  try {
    const { data } = await api("/api/me");
    user = data.user;
    googleConfigured = data.googleConfigured;
  } catch {
    user = null;
    googleConfigured = false;
  }
  $("accountButton").textContent = user ? "Мой профиль" : "Войти / мой профиль";
  await account();
}
async function login(kind) {
  if (native) {
    const { data } = await api("/api/mobile/launch", {
      method: "POST",
      body: { kind },
    });
    pending = { ...data, expires: Date.now() + 600000 };
    await Browser.open({ url: data.url });
    startPoll();
  } else location.assign((config.apiBase || "") + "/auth/" + kind);
}
let polling = false;
async function poll() {
  if (!pending || polling) return;
  polling = true;
  try {
    if (Date.now() > pending.expires) {
      pending = null;
      toast("Время входа истекло. Повтори попытку.");
      return;
    }
    const { data, status } = await api("/api/mobile/exchange", {
      method: "POST",
      body: { id: pending.id, secret: pending.secret },
    });
    if (status !== 202) {
      bearer = data.token;
      pending = null;
      await Browser.close().catch(() => {});
      await me();
      toast("Профиль подключён");
    }
  } catch (e) {
    pending = null;
    toast(e.message);
  } finally {
    polling = false;
  }
}
function startPoll() {
  const timer = setInterval(() => {
    if (!pending) clearInterval(timer);
    else poll();
  }, 2000);
  poll();
}
if (native)
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      poll();
      refreshMeta();
    }
  });
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
if (native && !config.apiBase) {
  googleConfigured = false;
}
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
