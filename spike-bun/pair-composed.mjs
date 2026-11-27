// Stage 3a (pair scope): serve the shell's and bio's own production builds at the
// URLs Pages composes them under (/nick-derobertis-site/ and
// /nick-derobertis-site/remotes/bio/), open the shell's /bio route in Chromium,
// and pass only if the shell loads bio's remoteEntry.js and renders bio's page
// through Module Federation with no failed asset or page error.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "@playwright/test";
const base = "/nick-derobertis-site/";
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json" };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const [root, rest] = path.startsWith(`${base}remotes/bio/`) ? ["dist/apps/bio", path.slice(`${base}remotes/bio/`.length)]
    : path.startsWith(base) ? ["dist/apps/shell", path.slice(base.length)] : [null, ""];
  if (!root) { res.writeHead(404).end(); return; }
  let file = join(root, rest || "index.html");
  try { if (!(await stat(file)).isFile()) throw 0; } catch { if (extname(rest)) { res.writeHead(404).end(); return; } file = join("dist/apps/shell", "index.html"); }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
});
await new Promise((r) => server.listen(4399, "127.0.0.1", r));
const browser = await chromium.launch(); const page = await browser.newPage(); const bad = []; const loaded = [];
page.on("requestfailed", (r) => bad.push(`failed ${r.url()}`));
page.on("response", (r) => { loaded.push(`${r.status()} ${r.url()}`); if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
page.on("pageerror", (e) => bad.push(`pageerror ${e.message}`));
let ok = false;
// Standalone: bio's own built document, at the URL the repo's ownership journeys open.
try {
  await page.goto(`http://127.0.0.1:4399${base}remotes/bio/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("heading", { name: "Optimizing Life", level: 1 }).waitFor({ timeout: 15000 });
  console.log(`standalone bio h1: ${await page.getByRole("heading", { level: 1 }).innerText()}; problems: ${bad.join("; ") || "none"}`);
} catch (e) { bad.push(`standalone: ${String(e.message).split("\n")[0]}`); }
const standaloneOk = bad.length === 0; console.log(`standalone bio: ${standaloneOk ? "PASS" : "FAIL"}`); loaded.length = 0;
try {
  await page.goto(`http://127.0.0.1:4399${base}bio`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("heading", { name: "Optimizing Life", level: 1 }).waitFor({ timeout: 15000 });
  const entry = loaded.find((l) => l.includes("/remotes/bio/remoteEntry.js"));
  console.log(`bio remoteEntry: ${entry ?? "not requested"}`);
  console.log(`h1: ${await page.getByRole("heading", { level: 1 }).innerText()}`);
  ok = standaloneOk && Boolean(entry?.startsWith("200")) && bad.length === 0;
} catch (e) { console.log(String(e.message).split("\n")[0]); }
console.log(`requests: ${loaded.length}; problems: ${bad.join("; ") || "none"}`);
console.log(`host-composed shell -> bio: ${ok ? "PASS" : "FAIL"}`);
await browser.close(); server.close(); process.exit(ok ? 0 : 1);
