import { cvDataClient } from "@site/data-access-core/bundled";
import { buildSkillTree } from "@site/data-access-skills";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { SkillsExperience } from "./skills-experience";

const tree = buildSkillTree(cvDataClient.domain("skills"));

function pane() {
  return screen.getByRole("region", { name: "Skilled in…" });
}

test("introduces the CV's own tree by its counts", () => {
  render(<SkillsExperience tree={tree} />);

  expect(
    within(pane()).getByRole("heading", { level: 2, name: "Skilled in…" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      `Browse ${tree.skillCount} skills in ${tree.children.length} categories.`,
      { exact: false },
    ),
  ).toBeInTheDocument();
});

test("opens on the chart, with the dropdown browser one click away", () => {
  render(<SkillsExperience tree={tree} />);

  expect(
    screen.getByRole("img", { name: "Skills sunburst chart" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Skills dropdown browser" }),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "View dropdowns" }));

  expect(
    screen.getByRole("region", { name: "Skills dropdown browser" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("img", { name: "Skills sunburst chart" }),
  ).not.toBeInTheDocument();
});

test("takes a visitor back to the chart from the dropdown browser", () => {
  render(<SkillsExperience tree={tree} />);
  fireEvent.click(screen.getByRole("button", { name: "View dropdowns" }));

  fireEvent.click(screen.getByRole("button", { name: "View chart" }));

  expect(
    screen.getByRole("img", { name: "Skills sunburst chart" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Skills dropdown browser" }),
  ).not.toBeInTheDocument();
});

test("names both browsers from the pane's own options panel", () => {
  render(<SkillsExperience tree={tree} />);

  const options = screen.getByRole("region", { name: "Skills options" });
  expect(
    within(options)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["View chart", "View dropdowns"]);
});
