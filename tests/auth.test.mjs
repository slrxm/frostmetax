import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.mjs";
import { hash, validateSteam } from "../server/security.mjs";

async function fixture(fn, fetchImpl) {
  const { app, db } = createApp({ dbPath: ":memory:", fetchImpl });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await fn({ base: `http://127.0.0.1:${server.address().port}`, db });
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
}
function seed(db) {
  db.prepare("INSERT INTO users(id,google_sub,email,name) VALUES(?,?,?,?)").run(
    "u1",
    "g1",
    "test@example.com",
    "Test",
  );
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    hash("session"),
    "u1",
    Date.now() + 60000,
  );
  return {
    Authorization: "Bearer session",
    "Content-Type": "application/json",
  };
}
test("forged Steam assertions are rejected before upstream verification", () => {
  const params = new URLSearchParams({
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://evil.test",
    "openid.return_to": "http://localhost:3000/auth/steam/callback?state=x",
  });
  assert.throws(() =>
    validateSteam(params, "http://localhost:3000/auth/steam/callback?state=x"),
  );
});
test("account deletion removes identity, sessions and pending mobile links", async () =>
  fixture(async ({ base, db }) => {
    const headers = seed(db);
    assert.equal((await fetch(base + "/api/me", { headers })).status, 200);
    const launch = await (
      await fetch(base + "/api/mobile/launch", {
        method: "POST",
        headers,
        body: JSON.stringify({ kind: "steam" }),
      })
    ).json();
    assert.ok(launch.secret);
    assert.equal(
      (await fetch(base + "/api/account", { method: "DELETE", headers }))
        .status,
      200,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) n FROM sessions").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) n FROM launches").get().n, 0);
  }));
test("mobile token exchange requires secret and is single use", async () =>
  fixture(async ({ base, db }) => {
    const headers = seed(db);
    const launch = await (
      await fetch(base + "/api/mobile/launch", {
        method: "POST",
        headers,
        body: '{"kind":"steam"}',
      })
    ).json();
    const exchange = (secret) =>
      fetch(base + "/api/mobile/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: launch.id, secret }),
      });
    assert.equal((await exchange("wrong")).status, 401);
    assert.equal((await exchange(launch.secret)).status, 202);
    db.prepare("UPDATE launches SET result_user=? WHERE id=?").run(
      "u1",
      launch.id,
    );
    const result = await (await exchange(launch.secret)).json();
    assert.ok(result.token);
    assert.equal((await exchange(launch.secret)).status, 401);
  }));
test("mutations reject another website origin", async () =>
  fixture(async ({ base, db }) => {
    const headers = { ...seed(db), Origin: "https://evil.example" };
    assert.equal(
      (await fetch(base + "/api/account", { method: "DELETE", headers }))
        .status,
      403,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 1);
  }));
test("Google callback requires browser-bound state", async () =>
  fixture(async ({ base }) => {
    const r = await fetch(
      base + "/auth/google/callback?state=forged&code=forged",
    );
    assert.equal(r.status, 400);
  }));
test("Steam callback verifies signed fields, server signature and account ownership", async () => {
  let verification = 0;
  await fixture(
    async ({ base, db }) => {
      seed(db);
      const r = await fetch(base + "/auth/steam", {
        headers: { Cookie: "fm_session=session" },
        redirect: "manual",
      });
      assert.equal(r.status, 302);
      const steam = new URL(r.headers.get("location"));
      const returnTo = steam.searchParams.get("openid.return_to");
      const callback = new URL(returnTo);
      const state = callback.searchParams.get("state");
      const claimed = "https://steamcommunity.com/openid/id/76561198083722517";
      callback.searchParams.set("openid.mode", "id_res");
      callback.searchParams.set(
        "openid.op_endpoint",
        "https://steamcommunity.com/openid/login",
      );
      callback.searchParams.set("openid.return_to", returnTo);
      callback.searchParams.set("openid.identity", claimed);
      callback.searchParams.set("openid.claimed_id", claimed);
      callback.searchParams.set(
        "openid.response_nonce",
        new Date().toISOString().replace(/\.\d{3}Z/, "Z") + "nonce",
      );
      callback.searchParams.set("openid.assoc_handle", "handle");
      callback.searchParams.set(
        "openid.signed",
        "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
      );
      callback.searchParams.set("openid.sig", "test");
      const response = await fetch(base + callback.pathname + callback.search, {
        headers: { Cookie: `fm_flow=${state}` },
        redirect: "manual",
      });
      assert.equal(response.status, 302);
      assert.equal(
        db.prepare("SELECT account_id FROM users WHERE id=?").get("u1")
          .account_id,
        "123456789",
      );
      assert.equal(verification, 1);
      const replay = await fetch(base + callback.pathname + callback.search, {
        headers: { Cookie: `fm_flow=${state}` },
        redirect: "manual",
      });
      assert.equal(replay.status, 400);
    },
    async (url, options) => {
      assert.equal(url, "https://steamcommunity.com/openid/login");
      assert.equal(options.body.get("openid.mode"), "check_authentication");
      verification++;
      return new Response(
        "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
      );
    },
  );
});
test("Google code flow exchanges PKCE and creates an HttpOnly session", async () => {
  const oldId = process.env.GOOGLE_CLIENT_ID,
    oldSecret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = "client";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  let calls = 0;
  try {
    await fixture(
      async ({ base, db }) => {
        const start = await fetch(base + "/auth/google", {
          redirect: "manual",
        });
        assert.equal(start.status, 302);
        const url = new URL(start.headers.get("location"));
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        const state = url.searchParams.get("state");
        const result = await fetch(
          base + `/auth/google/callback?state=${state}&code=code`,
          { headers: { Cookie: `fm_flow=${state}` }, redirect: "manual" },
        );
        assert.equal(result.status, 302);
        assert.match(result.headers.get("set-cookie"), /HttpOnly/);
        assert.equal(
          db.prepare("SELECT email FROM users").get().email,
          "person@example.com",
        );
        assert.equal(calls, 2);
      },
      async (url, options) => {
        calls++;
        if (url.endsWith("/token")) {
          assert.ok(options.body.get("code_verifier"));
          assert.equal(options.body.get("code"), "code");
          return Response.json({ access_token: "google-token" });
        }
        assert.equal(options.headers.Authorization, "Bearer google-token");
        return Response.json({
          sub: "google-subject",
          email: "person@example.com",
          email_verified: true,
          name: "Person",
        });
      },
    );
  } finally {
    if (oldId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = oldSecret;
  }
});
