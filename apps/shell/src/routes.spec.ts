import { describe, expect, it } from "vitest";
import { routes } from "./routes";

describe("route contract", () => {
  it("defines every public route uniquely", () => {
    expect(routes.map((r) => r.path)).toEqual([
      "/",
      "/bio",
      "/research",
      "/software",
      "/courses",
      "/awards",
    ]);
    expect(new Set(routes.map((r) => r.label)).size).toBe(6);
  });
});
