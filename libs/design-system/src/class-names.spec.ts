import { expect, test } from "vitest";
import { classNames } from "./class-names";

test("keeps the primitive's own class ahead of what an app adds", () => {
  expect(classNames("card", "award-card")).toBe("card award-card");
});

test("drops a modifier an app did not ask for rather than emitting it", () => {
  expect(classNames("pane", false && "pane-contained", undefined)).toBe("pane");
  expect(classNames("pane", true && "pane-contained", "home-cards")).toBe(
    "pane pane-contained home-cards",
  );
});
