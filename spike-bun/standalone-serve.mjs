// Stage 3b: start each remote's own `serve` target under bun, read the URL the
// dev server prints, open it in Chromium, and fail on a failed asset, a page
// error, or an empty #root. Usage: node spike-bun/standalone-serve.mjs <app>...
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
const apps = process.argv.slice(2); let failed = 0;
const browser = await chromium.launch();
for (const app of apps) {
  const child = spawn("bun", ["x", "nx", "run", `${app}:serve`, "--skip-nx-cache"], { stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  const url = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 180000);
    const on = (d) => { log += d; const m = log.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/?/); if (m) { clearTimeout(t); resolve(m[0]); } };
    child.stdout.on("data", on); child.stderr.on("data", on); child.on("exit", () => { clearTimeout(t); resolve(null); });
  });
  let ok = false, why = "dev server printed no URL";
  if (url) {
    const page = await browser.newPage(); const bad = [];
    page.on("requestfailed", (r) => bad.push(`failed ${r.url()}`));
    page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
    page.on("pageerror", (e) => bad.push(`pageerror ${e.message}`));
    try { await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      const text = (await page.locator("#root").innerText({ timeout: 10000 })).trim();
      ok = bad.length === 0 && text.length > 0; why = ok ? `rendered ${text.length} chars` : (bad.join("; ") || "empty #root");
    } catch (e) { why = String(e.message).split("\n")[0]; }
    await page.close();
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  console.log(`standalone ${app}: ${ok ? "PASS" : "FAIL"} (${url ?? "-"}) ${why}`);
  if (!ok) { failed++; console.log(log.split("\n").slice(-15).join("\n")); }
}
await browser.close(); process.exit(failed ? 1 : 0);
