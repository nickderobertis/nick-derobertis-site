import { expect, test } from "vitest";
import { formatNumber } from "./format-number";

test("groups a count so a reader can size it at a glance", () => {
  expect(formatNumber(19_513)).toBe("19,513");
  expect(formatNumber(0)).toBe("0");
  expect(formatNumber(459)).toBe("459");
});
