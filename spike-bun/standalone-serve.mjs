// Stage 3b: start each remote's own `serve` target (Nx 24 inferred `rspack serve`)
// under bun on an explicit port, wait for its standalone document at
// /nick-derobertis-site/remotes/<app>/ to answer, open it in Chromium, and fail
// on a failed or 4xx/5xx asset, a page error, or a missing expected h1.
// Usage: node spike-bun/standalone-serve.mjs <app>[=<h1 text>]...
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
const specs = process.argv.slice(2).map((a) => a.split("=")); let failed = 0;
const browser = await chromium.launch();
for (const [i, [app, heading]] of specs.entries()) {
  const port = 4410 + i;
  const url = `http://127.0.0.1:${port}/nick-derobertis-site/remotes/${app}/`;
  const child = spawn("bun", ["x", "nx", "run", `${app}:serve`, `--port=${port}`, "--skip-nx-cache"], { stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "", exited = false;
  child.stdout.on("data", (d) => { log += d; }); child.stderr.on("data", (d) => { log += d; }); child.on("exit", () => { exited = true; });
  let up = false;
  for (const start = Date.now(); !up && !exited && Date.now() - start < 180000; await new Promise((r) => setTimeout(r, 1000)))
    up = await fetch(url).then((r) => r.ok, () => false);
  let ok = false, why = exited ? "dev server exited" : "dev server never answered";
  if (up) {
    const page = await browser.newPage(); const bad = [];
    page.on("requestfailed", (r) => bad.push(`failed ${r.url()}`));
    page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
    page.on("pageerror", (e) => bad.push(`pageerror ${e.message.split("\n")[0]}`));
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      const h1 = page.getByRole("heading", { level: 1, ...(heading ? { name: heading } : {}) });
      await h1.waitFor({ timeout: 30000 });
      const text = await h1.innerText();
      ok = bad.length === 0; why = `h1 "${text}"; problems: ${bad.join("; ") || "none"}`;
    } catch (e) { why = `${String(e.message).split("\n")[0]}; problems: ${bad.join("; ") || "none"}`; }
    await page.close();
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  await new Promise((r) => (exited ? r() : child.on("exit", r)));
  console.log(`standalone serve ${app}: ${ok ? "PASS" : "FAIL"} (${url}) ${why}`);
  if (!ok) { failed++; console.log(log.replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((l) => !l.startsWith("chunk")).slice(-25).join("\n")); }
}
await browser.close(); process.exit(failed ? 1 : 0);
