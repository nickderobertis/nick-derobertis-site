import { cvDataClient } from "@site/data-access-core/bundled";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProjectCard } from "./project-card";

const projects = cvDataClient.domain("software_projects");

function projectById(id: string) {
  const project = projects.find((candidate) => candidate.id === id);
  if (!project) throw new Error(`The CV no longer records the ${id} project`);
  return project;
}

function card() {
  return screen.getByRole("article");
}

function linkNames() {
  return within(card())
    .queryAllByRole("link")
    .map((link) => link.textContent);
}

test("titles a project by its display name and shows the package it ships as", () => {
  render(<ProjectCard project={projectById("data-code")} />);

  expect(
    within(card()).getByRole("heading", {
      name: "Python Tools for Working with Data",
    }),
  ).toBeInTheDocument();
  expect(within(card()).getByText("datacode")).toBeInTheDocument();
  expect(
    within(card()).getByRole("img", {
      name: "Python Tools for Working with Data logo",
    }),
  ).toHaveAttribute(
    "src",
    "https://nickderobertis.github.io/derobertis-project-logo/_images/datacode.svg",
  );
});

test("reads out the counts the CV records for the project", () => {
  render(<ProjectCard project={projectById("fin-model-course")} />);

  expect(
    within(card())
      .getAllByRole("term")
      .map((term) => term.textContent),
  ).toEqual(["Lines of code", "Commits"]);
  expect(
    within(card())
      .getAllByRole("definition")
      .map((definition) => definition.textContent),
  ).toEqual(["19,513", "487"]);
});

test("falls back to the repository name when the CV records no display name", () => {
  render(<ProjectCard project={projectById("pypi-sphinx-quickstart")} />);

  expect(
    within(card()).getByRole("heading", { name: "pypi-sphinx-quickstart" }),
  ).toBeInTheDocument();
  // Two of the three fallbacks land on this project at once, so the package
  // line repeats the repository name and the logo becomes the code glyph.
  expect(within(card()).getAllByText("pypi-sphinx-quickstart")).toHaveLength(2);
  expect(within(card()).queryByRole("img")).not.toBeInTheDocument();
  expect(within(card()).getByText("</>")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("draws an inlined logo the CV carries as image data", () => {
  const project = projectById("datastream-excel-downloader-py");

  render(<ProjectCard project={project} />);

  expect(
    within(card()).getByRole("img", {
      name: "Datastream Excel Downloader logo",
    }),
  ).toHaveAttribute("src", project.logo_base64 ?? "");
});

test("offers only the destinations the CV records for the project", () => {
  render(<ProjectCard project={projectById("data-code")} />);
  // Its site and repository are the same address, so a third link would send a
  // visitor back where the first one already goes.
  expect(linkNames()).toEqual(["Repository", "Documentation"]);
});

test("adds a project site only when it is somewhere the repository is not", () => {
  render(<ProjectCard project={projectById("py-research-workflows")} />);

  expect(linkNames()).toEqual(["Repository", "Documentation", "Project site"]);
  expect(
    within(card()).getByRole("link", { name: "Project site" }),
  ).toHaveAttribute(
    "href",
    "https://nickderobertis.github.io/py-research-workflows/",
  );
});

test("offers no destinations for a project the CV publishes nowhere", () => {
  render(<ProjectCard project={projectById("derobertis-consulting")} />);

  expect(linkNames()).toEqual([]);
});

test("still reads as a card when the CV records nothing but the project's name", () => {
  // A project added to the CV before its repository has been measured or
  // described still has to give a visitor something to read, not a blank card
  // with two empty statistics in it.
  render(<ProjectCard project={{ id: "brand-new", name: "brand-new" }} />);

  expect(
    within(card()).getByRole("heading", { name: "brand-new" }),
  ).toBeInTheDocument();
  expect(
    within(card()).getByText("A maintained open-source software project."),
  ).toBeInTheDocument();
  expect(
    within(card())
      .getAllByRole("definition")
      .map((definition) => definition.textContent),
  ).toEqual(["0", "0"]);
  expect(linkNames()).toEqual([]);
});
