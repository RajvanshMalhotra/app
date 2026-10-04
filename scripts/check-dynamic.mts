// After `next build`: no page may bake request-time state into its prerendered HTML.
// /signin lists the sign-in methods configured at runtime, so it must render per request.
// /today may be a static shell, but must not contain a date fixed at build time.
import { existsSync, readFileSync } from "node:fs";

const problems: string[] = [];
const manifest = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
if ("/signin" in manifest.routes) problems.push("/signin is prerendered at build time");

const todayHtml = ".next/server/app/today.html";
if (existsSync(todayHtml) && /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),/.test(readFileSync(todayHtml, "utf8")))
  problems.push("/today has a build-time date baked in");

if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
console.log("ok: no request-time state baked into prerendered pages");
