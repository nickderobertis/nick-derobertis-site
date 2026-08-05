import { cvDataClient } from "@site/data-access-core";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { ResourceTree } from "./resource-tree";

const courses = cvDataClient.domain("courses");
const financialModeling = courses.find((course) => course.id === "FIN-4934");
if (!financialModeling)
  throw new Error("The CV no longer records the FIN-4934 course");
const publishedResources = financialModeling.resources ?? [];

test("keeps a nested reading list under the topic it belongs to", () => {
  render(<ResourceTree resources={publishedResources} />);

  const topics = within(screen.getAllByRole("list")[0] as HTMLElement);
  const python = topics
    .getAllByRole("listitem")
    .find((item) => item.textContent?.startsWith("Python"));
  expect(python).toBeDefined();
  // The Python topic groups four kinds of tutorial, each of which groups its
  // own links, so the reading list has to nest rather than flatten.
  expect(
    within(python as HTMLElement).getAllByRole("list")[0],
  ).toBeInTheDocument();
  expect(
    within(python as HTMLElement).getByRole("link", {
      name: "Python from Scratch",
    }),
  ).toHaveAttribute(
    "href",
    "https://open.cs.uwaterloo.ca/python-from-scratch/",
  );
});

test("credits an author and repeats the note the CV records for a resource", () => {
  render(<ResourceTree resources={publishedResources} />);

  const codecademy = screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.startsWith("Learn Python 2"));
  expect(codecademy).toBeDefined();
  expect(
    within(codecademy as HTMLElement).getByText("by codecademy", {
      exact: false,
    }),
  ).toBeInTheDocument();
  expect(
    within(codecademy as HTMLElement).getByText(/teaches Python 2/),
  ).toBeInTheDocument();
});

test("names a heading resource that links nowhere without offering a dead link", () => {
  render(
    <ResourceTree
      resources={[{ name: "Excel", children: [{ name: "Cell references" }] }]}
    />,
  );

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Excel").tagName).toBe("STRONG");
  expect(screen.getByText("Cell references")).toBeInTheDocument();
});

test("stops nesting at a resource the CV records no children for", () => {
  render(
    <ResourceTree
      resources={[
        { name: "learnpython.org", url: "https://www.learnpython.org/" },
        { name: "A leaf with an empty child list", children: [] },
      ]}
    />,
  );

  expect(screen.getAllByRole("list")).toHaveLength(1);
  expect(
    screen.getByRole("link", { name: "learnpython.org" }),
  ).toBeInTheDocument();
});

test("renders nothing to read when a course publishes no resources", () => {
  render(<ResourceTree resources={[]} />);

  expect(screen.getByRole("list")).toBeEmptyDOMElement();
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
