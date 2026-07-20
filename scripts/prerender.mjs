import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const output = "dist/apps/shell";
const routes = ["", "bio", "research", "software", "courses"];
const template = await readFile(join(output, "index.html"), "utf8");
for (const route of routes) {
  const directory = join(output, route);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "index.html"), template);
}
await cp(join(output, "index.html"), join(output, "404.html"));
