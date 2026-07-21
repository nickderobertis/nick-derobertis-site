import { readFileSync } from "node:fs";
import { siteBase } from "@site/data-access-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { homeContent, readPaneState } from "./home";

describe("HOME content boundary", () => {
  it("defaults to happy and accepts every supported state", () => {
    expect(readPaneState("")).toBe("happy");
    for (const state of ["happy", "empty", "loading", "error"])
      expect(readPaneState(`?state=${state}`)).toBe(state);
  });

  it("turns an untrusted state into a visible error state", () => {
    expect(readPaneState("?state=surprise")).toBe("error");
  });

  it("provides all marketing domains from one typed source", () => {
    expect(siteBase).toBe("/nick-derobertis-site");
    expect(homeContent.carousel).toHaveLength(2);
    expect(homeContent.cards.map(({ link }) => link)).toEqual([
      "/software",
      "/courses",
      "/research",
    ]);
    expect(homeContent.story.link).toBe("/bio");
    expect(homeContent.contact.links).toHaveLength(3);
  });

  it("keeps internal links aligned with the shell route contract", () => {
    const routes = z
      .array(z.object({ path: z.string() }))
      .parse(JSON.parse(readFileSync("apps/shell/src/routes.json", "utf8")));
    const routePaths = new Set(routes.map(({ path }) => path));
    const links = [
      ...homeContent.carousel.map(({ link }) => link),
      ...homeContent.cards.map(({ link }) => link),
      homeContent.story.link,
    ];
    expect(links.every((link) => routePaths.has(link))).toBe(true);
  });
});
