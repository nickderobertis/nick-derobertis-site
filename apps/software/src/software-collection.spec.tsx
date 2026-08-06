import { cvDataClient } from "@site/data-access-core";
import { calculateSoftwareStats } from "@site/data-access-software";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { formatNumber } from "./format-number";
import { SoftwareCollection } from "./software-collection";

const projects = cvDataClient.domain("software_projects");

function statistics() {
  const totals = screen.getByLabelText("Software statistics");
  return {
    terms: within(totals)
      .getAllByRole("term")
      .map((term) => term.textContent),
    values: within(totals)
      .getAllByRole("definition")
      .map((definition) => definition.textContent),
  };
}

test("totals the open-source work the CV publishes above the grid", () => {
  const stats = calculateSoftwareStats(projects);

  render(<SoftwareCollection projects={projects} />);

  expect(statistics()).toEqual({
    terms: ["Open-source projects", "Lines of code", "Commits"],
    values: [
      formatNumber(projects.length),
      formatNumber(stats.linesOfCode),
      formatNumber(stats.commits),
    ],
  });
  expect(statistics().values[0]).toBe("72");
});

test("gives every published project its own card in the grid", () => {
  render(<SoftwareCollection projects={projects} />);

  const grid = screen.getByRole("region", { name: "Software projects" });
  expect(within(grid).getAllByRole("article")).toHaveLength(projects.length);
  expect(
    within(grid).getByRole("heading", { name: "Python Extends LaTeX" }),
  ).toBeInTheDocument();
});

test("totals a single project without pretending to a portfolio", () => {
  const project = projects.find((candidate) => candidate.id === "sensitivity");
  if (!project)
    throw new Error("The CV no longer records the sensitivity project");

  render(<SoftwareCollection projects={[project]} />);

  expect(statistics().values).toEqual(["1", "673", "57"]);
  expect(screen.getAllByRole("article")).toHaveLength(1);
});

test("reads zero across the board when there is nothing to show", () => {
  render(<SoftwareCollection projects={[]} />);

  expect(statistics().values).toEqual(["0", "0", "0"]);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
