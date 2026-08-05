import { cvDataClient } from "@site/data-access-core";
import { buildSkillTree } from "@site/data-access-skills";
import { render, screen } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const tree = buildSkillTree(cvDataClient.domain("skills"));

async function renderPane() {
  const { default: SkillsPage } = await import("./page");
  return render(<SkillsPage />);
}

function openWith(query: string) {
  window.history.replaceState(null, "", query);
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the CV's whole skill tree for a visitor who just arrives", async () => {
  await renderPane();

  expect(
    screen.getByRole("region", { name: "Skilled in…" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(`Browse ${tree.skillCount} skills`, { exact: false }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Skills sunburst chart" }),
  ).toBeInTheDocument();
});

test("holds the loading frame for a visitor steering the pane into it", async () => {
  openWith("/?skills-state=loading");

  await renderPane();

  expect(
    screen.getByRole("status", { name: "Loading skills" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("img", { name: "Skills sunburst chart" }),
  ).not.toBeInTheDocument();
});

test("reports a CV with no skills as a status rather than an empty chart", async () => {
  openWith("/?skills-state=empty");

  await renderPane();

  expect(screen.getByRole("status")).toHaveTextContent(
    "No skills are available.",
  );
  expect(
    screen.queryByRole("img", { name: "Skills sunburst chart" }),
  ).not.toBeInTheDocument();
});

test("reports unavailable skills as an alert", async () => {
  openWith("/?skills-state=error");

  await renderPane();

  expect(screen.getByRole("alert")).toHaveTextContent("Skills unavailable");
  expect(
    screen.queryByRole("img", { name: "Skills sunburst chart" }),
  ).not.toBeInTheDocument();
});

test("ignores a steer it has no state for and shows the tree", async () => {
  openWith("/?skills-state=not-a-skills-state");

  await renderPane();

  expect(
    screen.getByRole("region", { name: "Skilled in…" }),
  ).toBeInTheDocument();
});

test("prerenders the settled tree the built fragment ships", async () => {
  const { default: SkillsPage } = await import("./page");
  vi.stubGlobal("window", undefined);

  const { prelude } = await prerender(<SkillsPage />);
  const html = await new Response(prelude).text();

  vi.unstubAllGlobals();
  // The build writes this markup straight into the published fragment, so parse
  // it the way a browser does before asking what a visitor finds in it.
  document.body.innerHTML = html;
  expect(
    screen.getByRole("region", { name: "Skilled in…" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Explore Programming category" }),
  ).toBeInTheDocument();
});
