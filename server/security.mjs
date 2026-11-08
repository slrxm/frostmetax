import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function steamId(claim) {
  const m = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/.exec(
    claim || "",
  );
  if (!m) throw Error("Invalid Steam identity");
  const id = BigInt(m[1]) - 76561197960265728n;
  if (id <= 0n || id > 4294967295n) throw Error("Invalid Steam account");
  return { steamId: m[1], accountId: String(id) };
}
export function validateSteam(params, returnTo) {
  if (
    params.get("openid.mode") !== "id_res" ||
    params.get("openid.op_endpoint") !==
      "https://steamcommunity.com/openid/login" ||
    params.get("openid.return_to") !== returnTo ||
    params.get("openid.identity") !== params.get("openid.claimed_id")
  )
    throw Error("Invalid Steam assertion");
  const signed = (params.get("openid.signed") || "").split(",");
  for (const key of [
    "op_endpoint",
    "claimed_id",
    "identity",
    "return_to",
    "response_nonce",
    "assoc_handle",
  ])
    if (!signed.includes(key)) throw Error("Unsigned Steam assertion");
  const nonce = params.get("openid.response_nonce") || "";
  const age = Date.now() - Date.parse(nonce.slice(0, 20));
  if (!Number.isFinite(age) || age < -60000 || age > 300000)
    throw Error("Expired Steam assertion");
  return steamId(params.get("openid.claimed_id"));
}
