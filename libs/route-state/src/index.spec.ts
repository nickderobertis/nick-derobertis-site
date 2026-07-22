import { describe, expect, it } from "vitest";
import { parseRouteView, routeViews } from ".";

describe("route view contract", () => {
  it.each(routeViews)("accepts the supported %s view", (view) => {
    expect(parseRouteView(view)).toBe(view);
  });

  it.each([undefined, null, "", "unexpected"])(
    "defaults invalid boundary value %s",
    (value) => {
      expect(parseRouteView(value)).toBe("default");
    },
  );
});
