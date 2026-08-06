import { cvDataClient } from "@site/data-access-core";
import { act, render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import SoftwarePage from "./page";

const published = cvDataClient.domain("software_projects");

function pageHeading() {
  return screen.getByRole("heading", {
    level: 1,
    name: "Open-Source Software",
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows the whole portfolio a visitor arrives at the route for", () => {
  render(<SoftwarePage />);

  expect(pageHeading()).toBeInTheDocument();
  const grid = screen.getByRole("region", { name: "Software projects" });
  expect(within(grid).getAllByRole("article")).toHaveLength(published.length);
  expect(
    within(screen.getByLabelText("Software statistics")).getAllByRole(
      "definition",
    )[0],
  ).toHaveTextContent("72");
});

test("keeps its banner while the loading frame settles onto the projects", () => {
  vi.useFakeTimers();

  render(<SoftwarePage initialView="loading" />);

  // The banner is the route's own copy, not the data's, so a visitor waiting on
  // the portfolio still knows which page they are on.
  expect(pageHeading()).toBeInTheDocument();
  expect(
    screen.getByRole("status", { name: "Loading software" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1_500);
  });
  expect(
    screen.getByRole("region", { name: "Software projects" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading software" }),
  ).not.toBeInTheDocument();
});

test("reports a portfolio with nothing in it as a status", () => {
  render(<SoftwarePage initialView="empty" />);

  const panel = screen.getByRole("status");
  expect(
    within(panel).getByRole("heading", {
      name: "No software projects to show",
    }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("New open-source work will appear here."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("reports an unavailable portfolio as an alert", () => {
  render(<SoftwarePage initialView="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", {
      name: "Software projects are unavailable",
    }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("Please try again later."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("shows the projects a host resolved rather than reading the CV again", () => {
  const hostProjects = published.slice(0, 3);

  render(<SoftwarePage projects={hostProjects} />);

  expect(screen.getAllByRole("article")).toHaveLength(3);
});

test("prerenders the whole portfolio into the fragment the build publishes", async () => {
  const { prelude } = await prerender(<SoftwarePage />);
  const html = await new Response(prelude).text();

  // The build writes this markup straight into the published fragment, so parse
  // it the way a browser does before asking what a visitor without JavaScript
  // is left with.
  document.body.innerHTML = html;
  expect(pageHeading()).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(published.length);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
