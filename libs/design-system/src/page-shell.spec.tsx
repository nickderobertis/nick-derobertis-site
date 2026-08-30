import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PageShell } from "./page-shell";

test("mounts a pane a visitor can find by the name its route gives it", () => {
  render(
    <PageShell aria-label="Areas of work">
      <p>Three areas</p>
    </PageShell>,
  );

  const pane = screen.getByRole("region", { name: "Areas of work" });
  expect(pane.tagName).toBe("SECTION");
  expect(pane).toHaveClass("pane");
  expect(pane).not.toHaveClass("pane-contained");
  expect(pane).toHaveTextContent("Three areas");
});

test("holds a contained pane to the reading width beside the app's own class", () => {
  render(
    <PageShell contained className="home-cards" aria-label="Areas of work">
      <p>Three areas</p>
    </PageShell>,
  );

  expect(screen.getByRole("region", { name: "Areas of work" })).toHaveClass(
    "pane",
    "pane-contained",
    "home-cards",
  );
});

test.each([
  ["article", "ARTICLE"],
  ["div", "DIV"],
] as const)("renders a %s route as one", (as, tag) => {
  render(
    <PageShell as={as} data-testid="shell">
      <p>Body</p>
    </PageShell>,
  );

  expect(screen.getByTestId("shell").tagName).toBe(tag);
});
