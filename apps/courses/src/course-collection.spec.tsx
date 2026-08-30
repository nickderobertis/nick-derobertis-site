import { courses } from "@site/data-access-courses";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { CourseCollection } from "./course-collection";

test("gives every course the CV records its own card in the list", () => {
  render(<CourseCollection courses={courses} />);

  const list = screen.getByRole("region", { name: "Course list" });
  expect(
    within(list)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual([
    "Financial Modeling",
    "Debt and Money Markets",
    "Financial Management Lab",
  ]);
});

test("alternates the cards' tone down the list", () => {
  const { container } = render(<CourseCollection courses={courses} />);

  expect(
    [...container.querySelectorAll("article")].map((card) =>
      card.className.includes("course-card-dark"),
    ),
  ).toEqual([false, true, false]);
});

test("still heads a list the CV has put no courses in", () => {
  render(<CourseCollection courses={[]} />);

  const list = screen.getByRole("region", { name: "Course list" });
  expect(within(list).queryByRole("article")).not.toBeInTheDocument();
});
