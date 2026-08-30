import { courses } from "@site/data-access-courses";
import { act, render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import CoursesPage from "./page";

const published = courses;

function pageHeading() {
  return screen.getByRole("heading", { level: 1, name: "Courses" });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows the whole catalogue a visitor arrives at the route for", () => {
  render(<CoursesPage />);

  expect(pageHeading()).toBeInTheDocument();
  const list = screen.getByRole("region", { name: "Course list" });
  expect(within(list).getAllByRole("article")).toHaveLength(published.length);
  expect(
    within(list).getByRole("heading", { level: 2, name: "Financial Modeling" }),
  ).toBeInTheDocument();
});

test("keeps its banner while the loading frame settles onto the courses", () => {
  vi.useFakeTimers();

  render(<CoursesPage initialView="loading" />);

  // The banner is the route's own copy, not the data's, so a visitor waiting on
  // the catalogue still knows which page they are on.
  expect(pageHeading()).toBeInTheDocument();
  expect(
    screen.getByRole("status", { name: "Loading courses" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  act(() => {
    vi.advanceTimersByTime(1_500);
  });
  expect(
    screen.getByRole("region", { name: "Course list" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("status", { name: "Loading courses" }),
  ).not.toBeInTheDocument();
});

test("reports a catalogue with nothing in it as a status", () => {
  render(<CoursesPage initialView="empty" />);

  const panel = screen.getByRole("status");
  expect(
    within(panel).getByRole("heading", { name: "No courses to show" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText(
      "Course information will appear here when it is available.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("reports an unavailable catalogue as an alert", () => {
  render(<CoursesPage initialView="error" />);

  const panel = screen.getByRole("alert");
  expect(
    within(panel).getByRole("heading", { name: "Courses are unavailable" }),
  ).toBeInTheDocument();
  expect(
    within(panel).getByText("Please try again later."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("shows the courses a host resolved rather than reading the CV again", () => {
  render(<CoursesPage courses={published.slice(0, 1)} />);

  expect(screen.getAllByRole("article")).toHaveLength(1);
});

test("prerenders the whole catalogue into the fragment the build publishes", async () => {
  const { prelude } = await prerender(<CoursesPage />);
  const html = await new Response(prelude).text();

  // The build writes this markup straight into the published fragment, so parse
  // it the way a browser does before asking what a visitor without JavaScript
  // is left reading.
  document.body.innerHTML = html;
  expect(pageHeading()).toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(published.length);
  // The syllabus ships as a disclosure, so a visitor without JavaScript can
  // still open it and read the whole syllabus out of the served bytes.
  expect(
    screen.getByText("Explore Financial Modeling details"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 3, name: "About this course" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
