import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ActionLink } from "./action-link";

test("leads to where the pane sends the visitor", () => {
  render(
    <ActionLink href="/nick-derobertis-site/software">
      View software
    </ActionLink>,
  );

  const link = screen.getByRole("link", { name: "View software" });
  expect(link).toHaveAttribute("href", "/nick-derobertis-site/software");
  expect(link).toHaveClass("action");
});

test("keeps the pane's own variant class beside the shared action class", () => {
  render(
    <ActionLink className="course-action" href="https://example.test/course">
      Course website
    </ActionLink>,
  );

  expect(screen.getByRole("link", { name: "Course website" })).toHaveClass(
    "action",
    "course-action",
  );
});

test("passes an anchor attribute the pane sets straight through", () => {
  render(
    <ActionLink href="#working-papers" aria-describedby="research-intro">
      View research
    </ActionLink>,
  );

  expect(screen.getByRole("link", { name: "View research" })).toHaveAttribute(
    "aria-describedby",
    "research-intro",
  );
});
