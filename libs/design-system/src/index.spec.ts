import { expect, test } from "vitest";
import * as designSystem from "./index";

// Every app reaches the primitives through this one specifier, so the barrel is
// the published surface rather than an implementation detail: a primitive that
// stops being exported here is one no app can adopt.
test("publishes every primitive an app composes its pages from", () => {
  expect(Object.keys(designSystem).sort()).toEqual([
    "ActionLink",
    "Card",
    "PageShell",
    "PaneState",
    "SectionHeading",
    "Skeleton",
  ]);
});
