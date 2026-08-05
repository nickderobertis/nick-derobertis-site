import { cvDataClient } from "@site/data-access-core";
import { buildResearchProjectModels } from "@site/data-access-research";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProjectSection } from "./project-section";

const research = cvDataClient.domain("research");
const workingPapers = buildResearchProjectModels(research, "working_paper");

test("heads the section and counts the papers filed under it", () => {
  render(
    <ProjectSection
      heading="Working Papers"
      id="working-papers"
      projects={workingPapers}
    />,
  );

  const section = screen.getByRole("region", { name: "Working Papers" });
  expect(within(section).getAllByRole("article")).toHaveLength(4);
  // The count is set two digits wide so a heading's numeral does not shift as
  // the collection grows past nine.
  expect(within(section).getByText("04")).toBeInTheDocument();
  expect(
    within(section).getByRole("heading", { level: 2, name: "Working Papers" }),
  ).toBeInTheDocument();
});

test("anchors the section so the banner link can reach it", () => {
  const { container } = render(
    <ProjectSection
      heading="Working Papers"
      id="working-papers"
      projects={workingPapers}
    />,
  );

  expect(container.querySelector("#working-papers")).toBe(
    screen.getByRole("region", { name: "Working Papers" }),
  );
});

test("still heads a section the CV has filed nothing under", () => {
  render(
    <ProjectSection heading="Works in Progress" id="works" projects={[]} />,
  );

  const section = screen.getByRole("region", { name: "Works in Progress" });
  expect(within(section).getByText("00")).toBeInTheDocument();
  expect(within(section).queryByRole("article")).not.toBeInTheDocument();
});
