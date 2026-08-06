import { siteBase } from "@site/data-access-core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import HomeCarouselPage from "./page";

const firstStory = "Finance researcher & educator";
const secondStory = "Serial founder & full-stack software engineer";

function visit(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return render(<HomeCarouselPage />);
}

function carousel() {
  return screen.getByRole("region", { name: "Featured work" });
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
});

test("opens on the first featured story with somewhere to go next", () => {
  visit("");

  const pane = carousel();
  expect(
    within(pane).getByRole("heading", { name: firstStory }),
  ).toBeInTheDocument();
  expect(
    within(pane).getByRole("link", { name: "View research" }),
  ).toHaveAttribute("href", `${siteBase}/research`);
  expect(within(pane).getByText("Story 1 of 2")).toBeInTheDocument();
});

test("takes a visitor to the next story and back with its own controls", () => {
  visit("");

  fireEvent.click(screen.getByRole("button", { name: "Next featured story" }));

  expect(screen.getByRole("heading", { name: secondStory })).toBeVisible();
  expect(screen.getByText("Story 2 of 2")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Software projects" }),
  ).toHaveAttribute("href", `${siteBase}/software`);

  fireEvent.click(
    screen.getByRole("button", { name: "Previous featured story" }),
  );

  expect(screen.getByRole("heading", { name: firstStory })).toBeVisible();
  expect(screen.getByText("Story 1 of 2")).toBeInTheDocument();
});

test("wraps backwards from the first story to the last", () => {
  visit("");

  fireEvent.click(
    screen.getByRole("button", { name: "Previous featured story" }),
  );

  expect(screen.getByText("Story 2 of 2")).toBeInTheDocument();
});

test("rotates on its own so a visitor who waits sees every story", () => {
  vi.useFakeTimers();
  visit("");

  act(() => vi.advanceTimersByTime(5000));

  expect(screen.getByRole("heading", { name: secondStory })).toBeVisible();
  expect(screen.getByText("Story 2 of 2")).toBeInTheDocument();
});

test("announces the story it swaps in without moving focus", () => {
  visit("");
  const next = screen.getByRole("button", { name: "Next featured story" });
  next.focus();

  fireEvent.click(next);

  // The copy is a live region, so the swapped-in story is announced where the
  // visitor is rather than by dragging focus to it.
  expect(
    screen.getByRole("heading", { name: secondStory }).parentElement,
  ).toHaveAttribute("aria-live", "polite");
  expect(document.activeElement).toBe(next);
});

test("holds its loading frame while a visitor previews that state", () => {
  visit("?state=loading");

  expect(
    screen.getByRole("status", { name: "Loading featured work" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("reports an empty rotation instead of a carousel with nothing in it", () => {
  visit("?state=empty");

  expect(screen.getByRole("status")).toHaveTextContent(
    "No featured stories are available yet.",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("reports an unreadable rotation", () => {
  visit("?state=error");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Featured stories could not be loaded.",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("treats a query it does not publish as an unreadable rotation", () => {
  visit("?state=whatever");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Featured stories could not be loaded.",
  );
});

test("prerenders the first story the built fragment ships", async () => {
  // The build renders this fragment with no window at all, so the pane has no
  // query to read and must publish the opening story itself.
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<HomeCarouselPage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();

  document.body.innerHTML = html;
  expect(carousel()).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: firstStory })).toBeInTheDocument();
  expect(screen.getByText("Story 1 of 2")).toBeInTheDocument();
});
