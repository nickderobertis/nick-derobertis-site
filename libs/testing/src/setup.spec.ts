import { render, screen } from "@testing-library/react";
import { createElement, lazy, Suspense } from "react";
import { expect, test } from "vitest";

/**
 * Longer than the one second Testing Library waits by default, and shorter than
 * the budget the setup file states. A host's pane really does arrive on the far
 * side of a dynamic import, so this one is behind a real `lazy` boundary that
 * has not settled when the query below starts waiting.
 */
const arrivesAfter = 1_500;

const Pane = lazy(async () => {
  await new Promise((settle) => setTimeout(settle, arrivesAfter));
  return {
    default: () =>
      createElement("section", { "aria-label": "Featured work" }, "arrived"),
  };
});

test("awaits a pane that arrives after the query default", async () => {
  render(
    createElement(
      Suspense,
      {
        fallback: createElement(
          "div",
          { role: "status", "aria-label": "Loading a pane" },
          "…",
        ),
      },
      createElement(Pane),
    ),
  );

  expect(
    screen.getByRole("status", { name: "Loading a pane" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("region", { name: "Featured work" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).toBeNull();
});
