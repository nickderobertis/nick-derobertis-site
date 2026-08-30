import type { ResearchStatus } from "@site/data-access-core";
import { research } from "@site/data-access-research";
import { act, render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ResearchPage from "./page";

const published = research;
const sectionStatuses: ResearchStatus[] = ["working_paper", "work_in_progress"];
const publishedCounts = sectionStatuses.map(
  (status) =>
    (published.projects ?? []).filter((project) => project.status === status)
      .length,
);

/**
 * How many papers each of the route's two sections is showing. The page itself
 * is an article, so a bare article count would include the wrapper as a tenth
 * paper.
 */
function projectCountsBySection() {
  return ["Working Papers", "Works in Progress"].map(
    (heading) =>
      within(screen.getByRole("region", { name: heading })).getAllByRole(
        "article",
      ).length,
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows the whole portfolio a visitor arrives at the route for", () => {
  render(<ResearchPage />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Research Works" }),
  ).toBeInTheDocument();
  expect(projectCountsBySection()).toEqual(publishedCounts);
  expect(publishedCounts).toEqual([4, 5]);
});

test("holds the loading frame and then settles onto the portfolio", () => {
  vi.useFakeTimers();

  render(<ResearchPage initialState={{ name: "loading" }} />);

  expect(
    screen.getByRole("status", { name: "Loading research" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1_500);
  });
  expect(
    screen.getByRole("region", { name: "Working Papers" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading research" }),
  ).not.toBeInTheDocument();
});

test("reports a CV with no research projects as an empty collection", () => {
  render(
    <ResearchPage initialState={{ name: "ready", value: { projects: [] } }} />,
  );

  expect(
    screen.getByRole("heading", { name: "No research projects yet" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("reports a CV whose research is missing entirely as empty too", () => {
  render(<ResearchPage initialState={{ name: "ready", value: {} }} />);

  expect(
    screen.getByRole("heading", { name: "No research projects yet" }),
  ).toBeInTheDocument();
});

test("reports research that could not be loaded", () => {
  render(<ResearchPage initialState={{ name: "error" }} />);

  const heading = screen.getByRole("heading", {
    name: "Research is unavailable",
  });
  const panel = heading.parentElement;
  if (!panel) throw new Error("The failure heading stands outside any panel");
  expect(
    within(panel).getByText(
      "The research collection could not be loaded. Please try again later.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("prerenders the whole portfolio into the fragment the build publishes", async () => {
  const { prelude } = await prerender(<ResearchPage />);
  const html = await new Response(prelude).text();

  // The build writes this markup straight into the published fragment, so parse
  // it the way a browser does before asking what a visitor without JavaScript
  // is left reading.
  document.body.innerHTML = html;
  expect(
    screen.getByRole("heading", { level: 1, name: "Research Works" }),
  ).toBeInTheDocument();
  expect(projectCountsBySection()).toEqual(publishedCounts);
  expect(publishedCounts).toEqual([4, 5]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
