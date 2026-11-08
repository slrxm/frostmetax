import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { token, hash, equal, validateSteam } from "./security.mjs";

export function createApp({
  dbPath = process.env.DB_PATH || "var/frostmeta.sqlite",
  publicUrl = process.env.PUBLIC_URL || "http://localhost:3000",
  fetchImpl = fetch,
} = {}) {
  const base = new URL(publicUrl);
  if (base.pathname !== "/" || !["http:", "https:"].includes(base.protocol))
    throw Error("PUBLIC_URL must be an origin");
  if (
    base.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(base.hostname)
  )
    throw Error("Production requires HTTPS");
  const secure = base.protocol === "https:";
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,google_sub TEXT UNIQUE NOT NULL,email TEXT NOT NULL,name TEXT NOT NULL,steam_id TEXT UNIQUE,account_id TEXT);
 CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS flows(state TEXT PRIMARY KEY,kind TEXT NOT NULL,user_id TEXT,mobile TEXT,verifier TEXT,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS launches(id TEXT PRIMARY KEY,secret_hash TEXT NOT NULL,kind TEXT NOT NULL,user_id TEXT,result_user TEXT,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS nonces(value TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
  const app = express();
  if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    }),
  );
  app.use(express.json({ limit: "8kb" }));
  const nativeOrigins = ["https://localhost", "capacitor://localhost"];
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (nativeOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    if (
      !["GET", "HEAD"].includes(req.method) &&
      origin &&
      origin !== base.origin &&
      !nativeOrigins.includes(origin)
    )
      return res.status(403).json({ error: "Недопустимый источник запроса" });
    next();
  });
  app.use(
    ["/api", "/auth"],
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(["/api", "/auth"], (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const cookie = (req) => {
    const m = /(?:^|;\s*)fm_session=([^;]+)/.exec(req.get("cookie") || "");
    return m?.[1];
  };
  const getToken = (req) =>
    req.get("authorization")?.startsWith("Bearer ")
      ? req.get("authorization").slice(7)
      : cookie(req);
  const getUser = (req) => {
    const t = getToken(req);
    return t
      ? db
          .prepare(
            "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.digest=? AND s.expires>?",
          )
          .get(hash(t), Date.now())
      : null;
  };
  const requireUser = (req, res, next) => {
    req.user = getUser(req);
    return req.user
      ? next()
      : res.status(401).json({ error: "Сначала войдите через Google" });
  };
  const view = (u) =>
    u
      ? {
          name: u.name,
          email: u.email,
          steamId: u.steam_id,
          accountId: u.account_id,
        }
      : null;
  const issue = (userId) => {
    const t = token();
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(t),
      userId,
      Date.now() + 30 * 86400000,
    );
    return t;
  };
  const setCookie = (res, t) =>
    res.cookie("fm_session", t, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 30 * 86400000,
      path: "/",
    });
  const configured = () =>
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const clean = () => {
    for (const table of ["sessions", "flows", "launches", "nonces"])
      db.prepare(`DELETE FROM ${table} WHERE expires<?`).run(Date.now());
  };
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/me", (req, res) =>
    res.json({ user: view(getUser(req)), googleConfigured: configured() }),
  );
  app.post("/api/logout", (req, res) => {
    const t = getToken(req);
    if (t) db.prepare("DELETE FROM sessions WHERE digest=?").run(hash(t));
    res.clearCookie("fm_session", {
      path: "/",
      secure,
      sameSite: "lax",
      httpOnly: true,
    });
    res.json({ ok: true });
  });
  app.delete("/api/steam", requireUser, (req, res) => {
    db.prepare("UPDATE users SET steam_id=NULL,account_id=NULL WHERE id=?").run(
      req.user.id,
    );
    res.json({ ok: true });
  });
  app.delete("/api/account", requireUser, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM launches WHERE user_id=? OR result_user=?").run(
      req.user.id,
      req.user.id,
    );
    db.prepare("DELETE FROM flows WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
    res.clearCookie("fm_session", {
      path: "/",
      secure,
      sameSite: "lax",
      httpOnly: true,
    });
    res.json({ ok: true });
  });
  app.post("/api/mobile/launch", (req, res) => {
    clean();
    const kind = req.body.kind;
    if (!["google", "steam"].includes(kind)) return res.sendStatus(400);
    const user = getUser(req);
    if (kind === "steam" && !user) return res.sendStatus(401);
    if (kind === "google" && !configured())
      return res.status(503).json({ error: "Вход Google ещё не настроен" });
    const id = token(),
      secret = token();
    db.prepare("INSERT INTO launches VALUES(?,?,?,?,NULL,?)").run(
      id,
      hash(secret),
      kind,
      user?.id || null,
      Date.now() + 600000,
    );
    res.json({ id, secret, url: `${base.origin}/auth/${kind}?launch=${id}` });
  });
  app.post("/api/mobile/exchange", (req, res) => {
    const { id, secret } = req.body;
    if (typeof id !== "string" || typeof secret !== "string")
      return res.sendStatus(400);
    const p = db
      .prepare("SELECT * FROM launches WHERE id=? AND expires>?")
      .get(id, Date.now());
    if (!p || !equal(p.secret_hash, hash(secret))) return res.sendStatus(401);
    if (!p.result_user) return res.status(202).json({ pending: true });
    db.prepare("DELETE FROM launches WHERE id=?").run(id);
    res.json({ token: issue(p.result_user) });
  });
  const begin = (kind, req, res) => {
    clean();
    let user = getUser(req),
      mobile = null;
    if (req.query.launch) {
      const p = db
        .prepare(
          "SELECT * FROM launches WHERE id=? AND kind=? AND expires>? AND result_user IS NULL",
        )
        .get(String(req.query.launch), kind, Date.now());
      if (!p) throw Error("Ссылка входа истекла");
      mobile = p.id;
      user = p.user_id
        ? db.prepare("SELECT * FROM users WHERE id=?").get(p.user_id)
        : null;
    }
    if (kind === "steam" && !user) throw Error("Сначала войдите через Google");
    const state = token(),
      verifier = token();
    db.prepare("INSERT INTO flows VALUES(?,?,?,?,?,?)").run(
      state,
      kind,
      user?.id || null,
      mobile,
      verifier,
      Date.now() + 600000,
    );
    res.cookie("fm_flow", state, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 600000,
      path: "/auth",
    });
    return { state, verifier };
  };
  const takeFlow = (kind, req) => {
    const state = String(req.query.state || "");
    const m = /(?:^|;\s*)fm_flow=([^;]+)/.exec(req.get("cookie") || "");
    if (!m || !equal(state, m[1]))
      throw Error("Сессия входа не совпадает. Повторите вход.");
    const f = db
      .prepare("SELECT * FROM flows WHERE state=? AND kind=? AND expires>?")
      .get(state, kind, Date.now());
    if (!f) throw Error("Время входа истекло");
    db.prepare("DELETE FROM flows WHERE state=?").run(state);
    return f;
  };
  const finish = (res, f, userId) => {
    if (f.mobile) {
      const result = db
        .prepare("UPDATE launches SET result_user=? WHERE id=? AND expires>?")
        .run(userId, f.mobile, Date.now());
      if (!result.changes) throw Error("Время входа истекло");
      return res
        .type("html")
        .send(
          '<!doctype html><meta charset="utf-8"><title>FROSTMETA</title><p>Готово. Вернитесь в приложение FROSTMETA.</p>',
        );
    }
    setCookie(res, issue(userId));
    res.redirect("/?account=1");
  };
  const remote = async (url, options) => {
    const r = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error("Сервис входа временно недоступен");
    return r;
  };
  app.get("/auth/google", (req, res) => {
    if (!configured())
      return res.status(503).send("Вход Google ещё не настроен");
    const { state, verifier } = begin("google", req, res);
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${base.origin}/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    res.redirect(u.href);
  });
  app.get("/auth/google/callback", async (req, res) => {
    const f = takeFlow("google", req);
    if (req.query.error) throw Error("Вход отменён");
    if (typeof req.query.code !== "string") throw Error("Нет кода авторизации");
    const result = await (
      await remote("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${base.origin}/auth/google/callback`,
          grant_type: "authorization_code",
          code_verifier: f.verifier,
        }),
      })
    ).json();
    if (!result.access_token) throw Error("Не удалось подтвердить Google");
    const profile = await (
      await remote("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${result.access_token}` },
      })
    ).json();
    if (!profile.sub || !profile.email || !profile.email_verified)
      throw Error("Почта Google не подтверждена");
    let user = db
      .prepare("SELECT * FROM users WHERE google_sub=?")
      .get(profile.sub);
    if (!user) {
      const id = token();
      db.prepare(
        "INSERT INTO users(id,google_sub,email,name) VALUES(?,?,?,?)",
      ).run(id, profile.sub, profile.email, profile.name || profile.email);
      user = { id };
    }
    finish(res, f, user.id);
  });
  app.get("/auth/steam", (req, res) => {
    const { state } = begin("steam", req, res);
    const u = new URL("https://steamcommunity.com/openid/login");
    u.search = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": `${base.origin}/auth/steam/callback?state=${state}`,
      "openid.realm": base.origin + "/",
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }).toString();
    res.redirect(u.href);
  });
  app.get("/auth/steam/callback", async (req, res) => {
    const f = takeFlow("steam", req);
    const params = new URL(req.originalUrl, base).searchParams;
    const identity = validateSteam(
      params,
      `${base.origin}/auth/steam/callback?state=${f.state}`,
    );
    const nonce = params.get("openid.response_nonce");
    if (db.prepare("SELECT 1 FROM nonces WHERE value=?").get(nonce))
      throw Error("Подтверждение уже использовано");
    const body = new URLSearchParams(
      [...params].filter(([k]) => k.startsWith("openid.")),
    );
    body.set("openid.mode", "check_authentication");
    const answer = await (
      await remote("https://steamcommunity.com/openid/login", {
        method: "POST",
        body,
      })
    ).text();
    if (!/^is_valid:true\r?$/m.test(answer))
      throw Error("Steam не подтвердил вход");
    db.prepare("INSERT INTO nonces VALUES(?,?)").run(
      nonce,
      Date.now() + 600000,
    );
    try {
      const r = db
        .prepare("UPDATE users SET steam_id=?,account_id=? WHERE id=?")
        .run(identity.steamId, identity.accountId, f.user_id);
      if (!r.changes) throw Error("Аккаунт не найден");
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw Error("Этот Steam уже привязан к другому аккаунту");
      throw e;
    }
    finish(res, f, f.user_id);
  });
  let metaCache = null,
    metaFetched = 0,
    metaRefreshing = false;
  try {
    metaCache = JSON.parse(readFileSync(resolve("dist/data.json"), "utf8"));
  } catch {}
  app.get("/meta-status.json", async (req, res) => {
    try {
      const r = await remote(
        "https://slrxm.github.io/frostmetax/meta-status.json",
      );
      res.set("Cache-Control", "no-cache").json(await r.json());
    } catch {
      res.status(404).json({ error: "Status not yet available" });
    }
  });
  app.get("/data.json", async (req, res, next) => {
    if (Date.now() - metaFetched > 300000 && !metaRefreshing) {
      metaRefreshing = true;
      remote("https://slrxm.github.io/frostmetax/data.json")
        .then((r) => r.json())
        .then((j) => {
          if (j.data && Array.isArray(j.ranks)) {
            metaCache = j;
            metaFetched = Date.now();
          }
        })
        .catch(() => {})
        .finally(() => {
          metaRefreshing = false;
        });
    }
    if (metaCache) return res.set("Cache-Control", "no-cache").json(metaCache);
    next();
  });
  app.get("/privacy", (req, res) =>
    res
      .type("text")
      .send(
        "FROSTMETA хранит имя и подтверждённую почту Google, Steam ID и привязку Dota 2. Пароли Google и Steam не поступают в приложение. Данные статистики запрашиваются у OpenDota и STRATZ. Удалить аккаунт и привязку можно в разделе «Аккаунт». Перед публикацией оператор должен указать контакты, сроки хранения и регион обработки в docs/PRIVACY.md.",
      ),
  );
  app.use(
    express.static(resolve("dist"), {
      dotfiles: "deny",
      setHeaders(res, path) {
        if (
          path.endsWith("data.json") ||
          path.endsWith("sw.js") ||
          path.endsWith("app-config.json")
        )
          res.set("Cache-Control", "no-cache");
      },
    }),
  );
  app.use((err, req, res, next) => {
    console.error("Request failed:", err.name);
    res
      .status(400)
      .json({ error: err.message || "Не удалось выполнить запрос" });
  });
  return { app, db };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { app } = createApp();
  app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("FROSTMETA server ready"),
  );
}
