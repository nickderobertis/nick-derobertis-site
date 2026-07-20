import { describe, expect, it } from "vitest";
import { homeContent, readPaneState } from "./home";
import { siteBase } from "./site";

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
});
