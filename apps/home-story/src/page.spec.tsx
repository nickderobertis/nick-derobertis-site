import { siteBase } from "@site/data-access-core/site";
import { render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { beforeEach, expect, test, vi } from "vitest";
import HomeStoryPage from "./page";

function visit(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return render(<HomeStoryPage />);
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

test("tells the story and offers the fuller bio", () => {
  visit("");

  const pane = screen.getByRole("region", { name: "Who am I?" });
  expect(within(pane).getByText("My story")).toBeInTheDocument();
  expect(
    within(pane).getByText(/I am a finance Ph\.D\., serial entrepreneur/),
  ).toBeInTheDocument();
  expect(within(pane).getByRole("link", { name: "View bio" })).toHaveAttribute(
    "href",
    `${siteBase}/bio`,
  );
});

test("describes the portrait for a visitor who cannot see it", () => {
  visit("");

  expect(
    screen.getByRole("img", { name: "Portrait of Nick DeRobertis" }),
  ).toBeInTheDocument();
});

test("holds its loading frame while a visitor previews that state", () => {
  visit("?state=loading");

  expect(
    screen.getByRole("status", { name: "Loading story" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("reports an unwritten story instead of an empty pane", () => {
  visit("?state=empty");

  expect(screen.getByRole("status")).toHaveTextContent(
    "No story is available yet.",
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("reports an unreadable story", () => {
  visit("?state=error");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Nick’s story could not be loaded.",
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("treats a query it does not publish as an unreadable story", () => {
  visit("?state=whatever");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Nick’s story could not be loaded.",
  );
});

test("prerenders the story the built fragment ships", async () => {
  // The build renders this fragment with no window at all, so the pane has no
  // query to read and must publish the story itself.
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<HomeStoryPage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();

  document.body.innerHTML = html;
  expect(screen.getByRole("region", { name: "Who am I?" })).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
