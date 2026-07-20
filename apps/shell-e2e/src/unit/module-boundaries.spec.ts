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
  it("allows approved shared libraries and the declared software remote", async () => {
    await expect(
      boundaryMessages(`
        import "@site/data-access";
        import "software/Page";
      `),
    ).resolves.toEqual([]);
  });

  it("rejects layout and undeclared remote dependencies", async () => {
    const messages = await boundaryMessages(`
      import "@site/layout";
      import "../../../bio/src/page";
    `);
    expect(messages).toHaveLength(2);
    expect(messages.every((message) => message.severity === 2)).toBe(true);
  });
});
