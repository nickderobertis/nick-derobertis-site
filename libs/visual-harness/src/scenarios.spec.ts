import type { Locator, Page } from "@playwright/test";
import { expect, test } from "vitest";
import { standardVisualScenarios } from "./scenarios.ts";

test("expands the deterministic viewport and render contract", () => {
  const scenarios = standardVisualScenarios({
    states: ["empty", "loading", "error"],
    query: (state) => `?state=${state}`,
    target: (page) => page.locator("body"),
  });
  expect(
    scenarios.map(({ render, state, viewports }) => ({
      render,
      state,
      viewports,
    })),
  ).toEqual([
    {
      render: "standalone",
      state: "happy",
      viewports: ["desktop", "tablet", "mobile"],
    },
    {
      render: "host-composed",
      state: "happy",
      viewports: ["desktop", "tablet", "mobile"],
    },
    { render: "standalone", state: "empty", viewports: ["desktop"] },
    { render: "host-composed", state: "empty", viewports: ["desktop"] },
    { render: "standalone", state: "loading", viewports: ["desktop"] },
    { render: "host-composed", state: "loading", viewports: ["desktop"] },
    { render: "standalone", state: "error", viewports: ["desktop"] },
    { render: "host-composed", state: "error", viewports: ["desktop"] },
  ]);
});

test("binds app-owned target and preparation behavior to every scenario", async () => {
  const prepared: string[] = [];
  const targeted: string[] = [];
  const scenarios = standardVisualScenarios({
    states: ["empty"],
    query: () => "",
    target: (_page, state) => {
      targeted.push(state);
      return {} as Locator;
    },
    prepare: async (_page, state) => {
      prepared.push(state);
    },
  });
  for (const scenario of scenarios) {
    scenario.target({} as Page);
    await scenario.prepare?.({} as Page);
  }
  expect(targeted).toEqual(["happy", "happy", "empty", "empty"]);
  expect(prepared).toEqual(targeted);
});
