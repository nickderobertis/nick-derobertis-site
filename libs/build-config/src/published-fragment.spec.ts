import { expect, test, vi } from "vitest";
import { sourceRevision } from "./published-fragment";

test("source revision falls back when Git is unavailable", () => {
  const readGitRevision = vi.fn(() => {
    throw new Error("not a git repository");
  });

  expect(sourceRevision(undefined, readGitRevision)).toBe("0000000");
  expect(readGitRevision).toHaveBeenCalledOnce();
});
