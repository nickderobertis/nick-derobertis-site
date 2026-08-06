import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import HomeFragmentPage from "./home-fragment-page";
import { validatedRemoteRegistry } from "./publish-fragment";
import remoteRegistry from "./remotes.json";

// The published Home fragment is a frame of empty slots: the shell's compose
// step fills each `<template>` with the pane remote of the same name. A slot
// naming a remote that does not exist is never filled, and the route document
// silently ships without that pane, so the names are checked against the
// canonical registry the compose step resolves them through.
describe("the published Home fragment frame", () => {
  test("renders the pane slots compose fills, in the order the page lays out", () => {
    const { container } = render(<HomeFragmentPage />);

    const slots = [
      ...container.querySelectorAll("template[data-published-fragment]"),
    ].map((slot) => slot.getAttribute("data-published-fragment"));
    expect(slots).toEqual([
      "home-carousel",
      "home-cards",
      "home-story",
      "skills",
      "awards",
      "home-contact",
      "timeline",
    ]);
  });

  test("names only remotes the canonical registry publishes", () => {
    const { container } = render(<HomeFragmentPage />);
    const registered = Object.keys(validatedRemoteRegistry(remoteRegistry));

    for (const slot of container.querySelectorAll(
      "template[data-published-fragment]",
    ))
      expect(registered).toContain(
        slot.getAttribute("data-published-fragment"),
      );
  });

  test("puts every slot inside the frame the composed route document expects", () => {
    const { container } = render(<HomeFragmentPage />);

    const frame = container.querySelector(".home-main");
    expect(frame).not.toBeNull();
    expect(frame?.querySelectorAll("template")).toHaveLength(7);
    // Slots carry no content of their own: a visitor sees the composed panes.
    expect(frame?.textContent).toBe("");
  });
});
