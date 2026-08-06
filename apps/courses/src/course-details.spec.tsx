import { type Course, cvDataClient } from "@site/data-access-core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { CourseDetails } from "./course-details";

const courses = cvDataClient.domain("courses");

function courseById(id: string): Course {
  const course = courses.find((candidate) => candidate.id === id);
  if (!course) throw new Error(`The CV no longer records the ${id} course`);
  return course;
}

function pane(heading: string) {
  const found = screen.getByRole("heading", { level: 3, name: heading });
  const surrounding = found.parentElement;
  if (!surrounding)
    throw new Error(`The ${heading} heading stands outside any pane`);
  return surrounding;
}

test("opens with the long description and how the course is currently offered", () => {
  render(<CourseDetails course={courseById("FIN-4934")} />);

  const overview = pane("About this course");
  expect(
    within(overview).getByText(/full financial modeling workflow/),
  ).toBeInTheDocument();
  expect(
    within(overview).getByText("Fall 2020 · Fully Online, Asynchronous"),
  ).toBeInTheDocument();
  expect(
    within(overview).getByText(/Microsoft Excel 2007 or newer/),
  ).toBeInTheDocument();
});

test("names the textbook, how it is published, and whether it is required", () => {
  render(<CourseDetails course={courseById("FIN-4934")} />);

  const textbook = pane("Textbook");
  expect(within(textbook).getByText("Financial Modeling")).toBeInTheDocument();
  expect(
    within(textbook).getByText("by Simon Benninga", { exact: false }),
  ).toBeInTheDocument();
  expect(
    within(textbook).getByText("Fourth Edition, MIT Press"),
  ).toBeInTheDocument();
  expect(within(textbook).getByText("Recommended")).toBeInTheDocument();
  expect(within(textbook).getByText(/only recommended/)).toBeInTheDocument();
});

test("marks a textbook the course insists on as required", () => {
  render(
    <CourseDetails
      course={{
        id: "FIN-0001",
        title: "A course with a required text",
        textbook: { title: "Investments", author: "Bodie", required: true },
      }}
    />,
  );

  const textbook = pane("Textbook");
  expect(within(textbook).getByText("Required")).toBeInTheDocument();
  expect(within(textbook).queryByText("Recommended")).not.toBeInTheDocument();
});

test("lists the courses and skills a student needs before enrolling", () => {
  render(<CourseDetails course={courseById("FIN-4934")} />);

  const prerequisites = pane("Prerequisites");
  expect(
    within(prerequisites).getByText("FIN-3403", { exact: false }),
  ).toBeInTheDocument();
  expect(
    within(prerequisites).getByText("FIN-4243, FIN-4504", { exact: false }),
  ).toBeInTheDocument();
  expect(
    within(prerequisites).getByRole("heading", {
      level: 4,
      name: "Technical skills",
    }),
  ).toBeInTheDocument();
  expect(
    within(prerequisites)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toContain("Excel");
  expect(
    within(prerequisites).getByText(/Understanding of algebra/),
  ).toBeInTheDocument();
});

test("shows a bare prerequisites pane when the CV records only the heading", () => {
  render(
    <CourseDetails
      course={{
        id: "FIN-0002",
        title: "A course with unspecified prerequisites",
        prerequisites: {},
      }}
    />,
  );

  expect(pane("Prerequisites")).toBeInTheDocument();
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { level: 4, name: "Technical skills" }),
  ).not.toBeInTheDocument();
});

test("weights the grading categories and files the scale behind a disclosure", () => {
  render(<CourseDetails course={courseById("FIN-4934")} />);

  const grading = pane("Grading");
  expect(
    within(grading)
      .getAllByRole("term")
      .map((term) => term.textContent),
  ).toContain("Lab Exercises");
  expect(
    within(grading)
      .getAllByRole("definition")
      .map((definition) => definition.textContent),
  ).toEqual(expect.arrayContaining(["20%", "80%"]));
  const scale = within(grading).getByRole("group");
  expect(scale).not.toHaveAttribute("open");

  fireEvent.click(within(grading).getByText("View grade scale"));

  expect(scale).toHaveAttribute("open");
  expect(within(scale).getByText("93–100")).toBeInTheDocument();
});

test("omits the grade scale for a course graded without one", () => {
  render(
    <CourseDetails
      course={{
        id: "FIN-0003",
        title: "A pass/fail course",
        grading: { categories: { Participation: 1 } },
      }}
    />,
  );

  const grading = pane("Grading");
  expect(within(grading).getByText("100%")).toBeInTheDocument();
  expect(within(grading).queryByRole("group")).not.toBeInTheDocument();
});

test("gathers a course's reading list under its own pane", () => {
  render(<CourseDetails course={courseById("FIN-4934")} />);

  const resources = pane("Resources");
  expect(
    within(resources).getByRole("link", { name: "Computer Science Circles" }),
  ).toBeInTheDocument();
});

test("shows nothing at all for a course the CV records no detail for", () => {
  const { container } = render(
    <CourseDetails course={courseById("FIN-4243")} />,
  );

  expect(container.querySelector(".course-details")).toBeEmptyDOMElement();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

test("shows an overview with neither an offering nor preparation named", () => {
  render(
    <CourseDetails
      course={{
        id: "FIN-0004",
        title: "A course not currently offered",
        long_description: "Taught on request.",
      }}
    />,
  );

  const overview = pane("About this course");
  expect(within(overview).getByText("Taught on request.")).toBeInTheDocument();
  expect(
    within(overview).queryByText("Current offering:", { exact: false }),
  ).not.toBeInTheDocument();
  expect(
    within(overview).queryByText("Preparation:", { exact: false }),
  ).not.toBeInTheDocument();
});

test("names the term a course runs in even when its meeting time is unset", () => {
  render(
    <CourseDetails
      course={{
        id: "FIN-0005",
        title: "A course with a term but no timetable",
        long_description: "Runs every spring.",
        current_period: "Spring 2027",
      }}
    />,
  );

  expect(
    within(pane("About this course")).getByText("Spring 2027"),
  ).toBeInTheDocument();
});
