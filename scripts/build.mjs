import { mkdir, copyFile, cp, rm, readFile } from "node:fs/promises";
import { build } from "esbuild";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const f of [
  "index.html",
  "data.json",
  "manifest.json",
  "sw.js",
  "favicon.png",
  "app-config.json",
  "app.css",
])
  await copyFile(f, `dist/${f}`);
try {
  await copyFile("meta-status.json", "dist/meta-status.json");
} catch {}
await cp("icons", "dist/icons", { recursive: true });
await build({
  entryPoints: ["src/app.mjs"],
  bundle: true,
  format: "esm",
  outfile: "dist/app.mjs",
  target: "es2022",
});
const config = JSON.parse(await readFile("app-config.json", "utf8"));
if (
  config.apiBase &&
  !config.apiBase.startsWith("https://") &&
  !config.apiBase.startsWith("http://localhost:")
)
  throw Error("apiBase must use HTTPS");
await copyFile("dist/app.mjs", "app.mjs");
console.log("Built dist/");
