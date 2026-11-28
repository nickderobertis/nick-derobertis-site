import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * AGENTS.md's dependency-freshness paragraph names the one dependency held
 * below its npm latest major and quotes the peers holding it, with their majors
 * and ranges, so the next `just upgrade` knows what to retry. Those facts come
 * from `bun.lock`; this spec is the gate that keeps the prose and the lockfile
 * agreeing, so a peer that moves major or widens its range, or a TypeScript
 * that moves, fails here rather than leaving the instructions quietly wrong.
 */

const lockEntrySchema = z.tuple([
  z.string(),
  z.string(),
  z
    .object({
      peerDependencies: z.record(z.string(), z.string()).optional(),
    })
    .passthrough(),
  z.string(),
]);

/**
 * One package's locked version and declared peers, read from its line in
 * `bun.lock`. bun writes each package as one `"name": [...],` line, so the line
 * alone is valid JSON once wrapped, and the schema refuses any other shape.
 */
function lockedPackage(lock: string, name: string) {
  const line = lock
    .split("\n")
    .find((candidate) =>
      candidate.startsWith(`    ${JSON.stringify(name)}: [`),
    );
  if (line === undefined)
    throw new Error(`bun.lock has no top-level entry for ${name}`);
  const [, entry] = z
    .tuple([z.string(), z.unknown()])
    .parse(Object.entries(JSON.parse(`{${line.trim().replace(/,$/, "")}}`))[0]);
  const [resolution, , meta] = lockEntrySchema.parse(entry);
  return {
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+/)
      .parse(resolution.slice(resolution.lastIndexOf("@") + 1)),
    peers: meta.peerDependencies ?? {},
  };
}

/** The paragraph that opens with the freshness rule, through its blank line. */
function freshnessParagraph(): string {
  const instructions = readFileSync("AGENTS.md", "utf8");
  const start = instructions.indexOf("Dependency freshness is checked with");
  if (start < 0)
    throw new Error("AGENTS.md has no dependency-freshness paragraph");
  const end = instructions.indexOf("\n\n", start);
  return instructions.slice(start, end < 0 ? undefined : end);
}

describe("held dependency record", () => {
  const lock = readFileSync("bun.lock", "utf8");
  const paragraph = freshnessParagraph();

  it("states the TypeScript major bun.lock resolves", () => {
    const stated = z.coerce
      .number()
      .int()
      .parse(/TypeScript stays on (\d+)\b/.exec(paragraph)?.[1]);
    const locked = Number(
      lockedPackage(lock, "typescript").version.split(".")[0],
    );
    expect(stated).toBe(locked);
  });

  it.each([
    ["nx", /\bNx (\d+)'s\b/],
    ["@typescript-eslint/parser", /`@typescript-eslint\/parser` (\d+)\b/],
  ])("states the %s major bun.lock resolves", (name, label) => {
    const stated = z.coerce.number().int().parse(label.exec(paragraph)?.[1]);
    const locked = Number(lockedPackage(lock, name).version.split(".")[0]);
    expect(stated).toBe(locked);
  });

  it("quotes each named peer's TypeScript range as bun.lock records it", () => {
    const named = [...paragraph.matchAll(/`(@[\w-]+\/[\w-]+)`/g)].map(
      ([match]) => match.slice(1, -1),
    );
    expect(named.length).toBeGreaterThan(0);
    const misquoted = named.flatMap((name) => {
      const range = lockedPackage(lock, name).peers.typescript;
      if (range === undefined)
        return [`${name} declares no typescript peer in bun.lock`];
      return paragraph.includes(range)
        ? []
        : [
            `${name} declares typescript ${range}, which AGENTS.md does not quote`,
          ];
    });
    expect(misquoted).toEqual([]);
  });

  it("refuses a paragraph naming a peer bun.lock does not hold", () => {
    expect(() => lockedPackage(lock, "@site/not-a-locked-package")).toThrow(
      /no top-level entry/,
    );
  });
});
