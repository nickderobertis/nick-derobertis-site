import { describe, expect, it } from "vitest";
import { parseRouteView, parseSiteRoutes, routeViews } from ".";

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

describe("site route config", () => {
  it("accepts complete static route records", () => {
    expect(
      parseSiteRoutes([
        { path: "/bio", label: "Bio", heading: "Bio", description: "Bio" },
      ]),
    ).toHaveLength(1);
  });

  it.each([
    { routes: [] },
    {
      routes: [
        { path: "bio", label: "Bio", heading: "Bio", description: "Bio" },
      ],
    },
    {
      routes: [{ path: "/bio", label: "", heading: "Bio", description: "Bio" }],
    },
  ])("rejects malformed route config", ({ routes }) => {
    expect(() => parseSiteRoutes(routes)).toThrow();
  });
});
