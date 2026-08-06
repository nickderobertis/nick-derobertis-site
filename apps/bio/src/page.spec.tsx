import { act, render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import BioPage from "./page";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

test("tells the story when a visitor arrives at the route itself", () => {
  render(<BioPage />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Optimizing Life" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("holds the loading frame and then settles onto the story", () => {
  vi.useFakeTimers();

  render(<BioPage initialView="loading" />);

  expect(
    screen.getByRole("status", { name: "Loading biography" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1_500);
  });
  expect(
    screen.getByRole("article", { name: "Optimizing Life" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading biography" }),
  ).not.toBeInTheDocument();
});

test("reports a biography that is not written yet as a status", () => {
  render(<BioPage initialView="empty" />);

  const panel = screen.getByRole("status");
  expect(
    within(panel).getByRole("heading", { name: "Biography coming soon" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("reports a biography that could not be displayed as an alert", () => {
  render(<BioPage initialView="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", { name: "Biography unavailable" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("prerenders the whole story into the fragment the build publishes", async () => {
  const { prelude } = await prerender(<BioPage />);
  const html = await new Response(prelude).text();

  // The build writes this markup straight into the published fragment, so parse
  // it the way a browser does before asking what a visitor without JavaScript
  // is left reading.
  document.body.innerHTML = html;
  const story = screen.getByRole("article", { name: "Optimizing Life" });
  expect(
    within(story)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(["Early Days", "Philosophy", "Day to Day"]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
