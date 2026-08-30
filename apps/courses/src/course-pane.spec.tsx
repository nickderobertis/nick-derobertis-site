import type { Course } from "@site/data-access-core";
import { courses } from "@site/data-access-courses";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { CoursePane } from "./course-pane";

function courseById(id: string): Course {
  const course = courses.find((candidate) => candidate.id === id);
  if (!course) throw new Error(`The CV no longer records the ${id} course`);
  return course;
}

function card() {
  return screen.getByRole("article");
}

test("titles a course, shows its code, and reads out how it was rated", () => {
  render(<CoursePane course={courseById("FIN-4934")} index={0} />);

  expect(
    within(card()).getByRole("heading", {
      level: 2,
      name: "Financial Modeling",
    }),
  ).toBeInTheDocument();
  // The CV stores the code with a hyphen; a reader sees the spoken form.
  expect(within(card()).getByText("FIN 4934")).toBeInTheDocument();
  expect(
    within(card()).getByText(/Financial modeling course which focuses/),
  ).toBeInTheDocument();
  expect(within(card()).getByText("Evaluation score")).toBeInTheDocument();
  expect(within(card()).getByText("4.5")).toBeInTheDocument();
  expect(within(card()).getByText("/ 5")).toBeInTheDocument();
});

test("lists the terms the course has been taught in", () => {
  render(<CoursePane course={courseById("FIN-4934")} index={0} />);

  const periods = within(card()).getByRole("list", { name: "Periods taught" });
  expect(
    within(periods)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Fall 2019", "Spring 2020", "Fall 2020"]);
});

test("names the university and where it teaches the course", () => {
  render(<CoursePane course={courseById("FIRE-311")} index={0} />);

  expect(
    within(card()).getByText("Virginia Commonwealth University"),
  ).toBeInTheDocument();
  expect(within(card()).getByText("Richmond, VA")).toBeInTheDocument();
});

test("says nothing about a rating the CV never recorded", () => {
  render(<CoursePane course={courseById("FIRE-311")} index={0} />);

  expect(
    within(card()).queryByText("Evaluation score"),
  ).not.toBeInTheDocument();
});

test("gathers the topics the course covers under their own heading", () => {
  render(<CoursePane course={courseById("FIN-4243")} index={0} />);

  const topics = within(card()).getByRole("region", {
    name: "Debt and Money Markets topics",
  });
  expect(
    within(topics)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Debt Analysis", "Debt Portfolio Management"]);
});

test("offers the course website when the CV publishes one", () => {
  render(<CoursePane course={courseById("FIN-4934")} index={0} />);

  expect(
    within(card()).getByRole("link", { name: "Course website" }),
  ).toHaveAttribute(
    "href",
    "https://nickderobertis.github.io/fin-model-course",
  );
});

test("files the syllabus behind a disclosure a reader has to open", () => {
  render(<CoursePane course={courseById("FIN-4934")} index={0} />);

  // The card is long enough already, so the syllabus arrives collapsed and the
  // reader opens it by the course's own name.
  const [syllabus] = within(card()).getAllByRole("group");
  if (!syllabus)
    throw new Error("The course card files no syllabus disclosure");
  const opener = within(card()).getByText("Explore Financial Modeling details");
  expect(syllabus).not.toHaveAttribute("open");

  fireEvent.click(opener);

  expect(syllabus).toHaveAttribute("open");
  expect(
    within(syllabus).getByRole("heading", {
      name: "About this course",
    }),
  ).toBeInTheDocument();
});

test("offers no disclosure for a course with no syllabus behind it", () => {
  render(<CoursePane course={courseById("FIN-4243")} index={0} />);

  expect(within(card()).queryByRole("group")).not.toBeInTheDocument();
});

test("alternates the tone of neighbouring cards so a reader can tell them apart", () => {
  const { container: light } = render(
    <CoursePane course={courseById("FIN-4243")} index={0} />,
  );
  const { container: dark } = render(
    <CoursePane course={courseById("FIN-4243")} index={1} />,
  );

  expect(light.querySelector("article")?.className).not.toContain(
    "course-card-dark",
  );
  expect(dark.querySelector("article")?.className).toContain(
    "course-card-dark",
  );
});

test("still reads as a card for a course the CV has only titled", () => {
  render(
    <CoursePane
      course={{ id: "FIN-0006", title: "A newly announced course" }}
      index={0}
    />,
  );

  expect(
    within(card()).getByRole("heading", {
      level: 2,
      name: "A newly announced course",
    }),
  ).toBeInTheDocument();
  expect(within(card()).getByText("FIN 0006")).toBeInTheDocument();
  expect(
    within(card()).queryByRole("list", { name: "Periods taught" }),
  ).not.toBeInTheDocument();
  expect(within(card()).queryByRole("link")).not.toBeInTheDocument();
  expect(within(card()).queryByRole("region")).not.toBeInTheDocument();
});

test("rates a course out of five when the CV records no maximum", () => {
  render(
    <CoursePane
      course={{
        id: "FIN-0007",
        title: "A course rated against no stated maximum",
        evaluation_score: 9.1,
        university_name: "University of Florida",
      }}
      index={0}
    />,
  );

  expect(within(card()).getByText("/ 5")).toBeInTheDocument();
  expect(within(card()).getByText("9.1")).toBeInTheDocument();
  // No location was recorded, so the university stands alone rather than
  // leaving an empty line beneath it.
  expect(within(card()).getByText("University of Florida")).toBeInTheDocument();
  expect(card().querySelector(".course-location")).not.toBeInTheDocument();
});
