import { expect, test } from "vitest";
import { siteBase } from "./site";
import siteConfig from "./site.config.json" with { type: "json" };
import { readPagesBase } from "./site-base.ts";

test("reads the committed site config's Pages base, the one the site module exports", () => {
  expect(readPagesBase(siteConfig)).toBe(siteBase);
  expect(siteBase).toBe("/nick-derobertis-site");
});

test("refuses a config that names no valid Pages base", () => {
  for (const pagesBase of ["", "site", "/", "/Site", "/site/../x", "/a b"])
    expect(() => readPagesBase({ pagesBase })).toThrow(
      "site.config.json pagesBase must be one lowercase path segment",
    );
});

test("refuses a non-string Pages base that RegExp.test would coerce into a match", () => {
  for (const pagesBase of [["/site"], { toString: () => "/site" }, 1, null])
    expect(() => readPagesBase({ pagesBase })).toThrow(
      "site.config.json pagesBase must be one lowercase path segment",
    );
});
