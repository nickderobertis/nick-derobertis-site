import { expect, test } from "vitest";
import { routePath } from "./route-path";
import { routes } from "./routes";

test("answers with the path the route manifest publishes each route at", () => {
  expect(routes.map((route) => routePath(route.label))).toEqual(
    routes.map((route) => route.path),
  );
  expect(routePath("Home")).toBe("/");
  expect(routePath("Bio")).toBe("/bio");
});

test("names the route that is missing rather than handing back no path", () => {
  // An undefined path would reach the router as a route matching nothing, and
  // the visitor would meet a 404 with nothing saying why.
  expect(() => routePath("Newsletter")).toThrow(
    "Missing Newsletter route in routes.json",
  );
});
