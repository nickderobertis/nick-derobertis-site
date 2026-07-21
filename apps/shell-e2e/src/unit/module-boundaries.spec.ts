import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function boundaryMessages(source: string) {
  const results = await eslint.lintText(source, {
    filePath: "apps/research/src/boundary-probe.ts",
  });
  const result = results[0];
  if (!result) throw new Error("ESLint returned no result for boundary probe");
  return result.messages.filter(
    (message) => message.ruleId === "@nx/enforce-module-boundaries",
  );
}

describe("remote module boundaries", () => {
  it("allows approved shared libraries", async () => {
    await expect(
      boundaryMessages(`
        import "@site/data-access-core";
        import "@site/data-access-research";
      `),
    ).resolves.toEqual([]);
  }, 15_000);

  it("rejects another feature's data library", async () => {
    const messages = await boundaryMessages(`
      import "@site/data-access-software";
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe(2);
  }, 15_000);

  it("rejects layout and all cross-remote dependencies", async () => {
    const messages = await boundaryMessages(`
      import "@site/layout";
      import "../../../software/src/page";
      import "../../../bio/src/page";
    `);
    expect(messages).toHaveLength(3);
    expect(messages.every((message) => message.severity === 2)).toBe(true);
  }, 15_000);
});
