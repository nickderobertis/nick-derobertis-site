import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import {
  homePanes,
  routeFragments,
  validatedHydrationMetadata,
  validateFragmentContracts,
} from "./compose.mjs";
import { remotesForRoute } from "./remote-css.mjs";

test("compose rejects independently published React version skew", () => {
  expect(() =>
    validateFragmentContracts([
      {
        schemaVersion: 1,
        name: "shell",
        react: "19.2.7",
        reactDom: "19.2.7",
        revision: "a11ce123",
      },
      {
        schemaVersion: 1,
        name: "awards",
        react: "19.3.0",
        reactDom: "19.2.7",
        revision: "b0b12345",
      },
    ]),
  ).toThrow(/React version skew.*shell.*19\.2\.7.*awards.*19\.3\.0/);
});

test("compose preserves router match delimiters while validating hydration", () => {
  const hydration =
    '<script>self.$_TSR={e(){}};$_TSR.router={matches:[{i:"\\0bio\\0"}]};$_TSR.e();document.currentScript.remove()</script>';
  expect(validatedHydrationMetadata(hydration, "/bio")).toBe(hydration);
});

test("composition maps stay aligned with federation and CSS ownership", async () => {
  const homeConfig = await readFile("apps/home/rspack.config.ts", "utf8");
  const homeFragmentPage = await readFile(
    "scripts/home-fragment-page.tsx",
    "utf8",
  );
  const configuredPanes = /remoteMap\(\[([\s\S]*?)\]\)/u
    .exec(homeConfig)?.[1]
    .match(/"([^"]+)"/g)
    ?.map((name) => name.slice(1, -1));
  expect([...homePanes].sort()).toEqual(configuredPanes?.sort());
  const publishedSlots = [
    ...homeFragmentPage.matchAll(/data-published-fragment="([^"]+)"/g),
  ].map((match) => match[1]);
  expect(publishedSlots).toEqual(homePanes);
  for (const [route, names] of Object.entries(routeFragments))
    expect(names).toEqual(remotesForRoute(route));
});
