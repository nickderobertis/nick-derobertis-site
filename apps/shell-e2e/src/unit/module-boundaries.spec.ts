import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

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
  let approvedMessages: Awaited<ReturnType<typeof boundaryMessages>>;
  let rejectedMessages: Awaited<ReturnType<typeof boundaryMessages>>;

  beforeAll(async () => {
    approvedMessages = await boundaryMessages(`
        import "@site/data-access";
        import "software/Page";
      `);
    rejectedMessages = await boundaryMessages(`
      import "@site/layout";
      import "../../../bio/src/page";
    `);
  }, 30_000);

  it("allows approved shared libraries and the declared software remote", () => {
    expect(approvedMessages).toEqual([]);
  });

  it("rejects layout and undeclared remote dependencies", () => {
    expect(rejectedMessages).toHaveLength(2);
    expect(rejectedMessages.every((message) => message.severity === 2)).toBe(
      true,
    );
  });
});
