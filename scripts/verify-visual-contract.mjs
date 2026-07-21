import { readFileSync } from "node:fs";

const contract = JSON.parse(readFileSync("visual-tools.json", "utf8"));
const sources = [
  ["workflow", readFileSync(".github/workflows/visual-docs.yml", "utf8")],
  ["visual runner", readFileSync("scripts/visual-project.sh", "utf8")],
  ["bootstrap", readFileSync("justfile", "utf8")],
  ["screencomp config", readFileSync("screencomp.toml", "utf8")],
];
for (const [key, value] of Object.entries(contract)) {
  const matches = sources.filter(([, source]) => source.includes(value));
  if (matches.length < 2)
    throw new Error(
      `Visual contract ${key}=${value} is not drift-checked across its consumers; update visual-tools.json and every visual consumer together`,
    );
}
console.log(
  "visual tool contract matches workflow, runner, and screencomp config",
);
