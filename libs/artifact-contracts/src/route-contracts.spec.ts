import { describe, expect, test } from "vitest";
import { parseRemoteManifest, routeContracts } from "./route-contracts.ts";

describe("route contracts", () => {
  test("publishes the prerender route attribute the compose step stamps", () => {
    expect(routeContracts.prerenderRouteAttribute).toMatch(/^data-[a-z-]+$/);
  });
});

describe("remote manifest parsing", () => {
  test("narrows a valid registry to its name and alias mapping", () => {
    expect(
      parseRemoteManifest({ "home-cards": "homeCards", bio: "bio" }),
    ).toEqual({ "home-cards": "homeCards", bio: "bio" });
  });

  test.each([
    ["a missing manifest", null],
    ["a manifest that is not an object", "home"],
    ["a manifest that is a list", ["home"]],
    ["a remote name no federation alias can be derived from", { Home: "home" }],
    ["an alias that is not a string", { home: 7 }],
  ])("rejects %s at the boundary that read it", (_case, value) => {
    expect(() => parseRemoteManifest(value)).toThrow(
      /must contain valid string mappings/,
    );
  });
});
