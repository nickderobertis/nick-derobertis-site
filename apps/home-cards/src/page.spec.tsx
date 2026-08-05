import { siteBase } from "@site/data-access-core";
import { render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { beforeEach, expect, test, vi } from "vitest";
import HomeCardsPage from "./page";

function visit(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return render(<HomeCardsPage />);
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

test("shows every area of work with somewhere to go next", () => {
  visit("");

  const pane = screen.getByRole("region", { name: "Areas of work" });
  expect(within(pane).getAllByRole("article")).toHaveLength(3);
  expect(
    within(pane)
      .getAllByRole("heading")
      .map((heading) => heading.textContent),
  ).toEqual(["Engineering", "Teaching", "Research"]);
  expect(
    within(pane).getByRole("link", { name: "View courses" }),
  ).toHaveAttribute("href", `${siteBase}/courses`);
});

test("holds its loading frame while a visitor previews that state", () => {
  visit("?state=loading");

  expect(
    screen.getByRole("status", { name: "Loading areas of work" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("reports an empty card list instead of an empty grid", () => {
  visit("?state=empty");

  expect(screen.getByRole("status")).toHaveTextContent(
    "No areas of work are available yet.",
  );
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("reports an unreadable card list", () => {
  visit("?state=error");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Areas of work could not be loaded.",
  );
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

test("treats a query it does not publish as an unreadable card list", () => {
  visit("?state=whatever");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Areas of work could not be loaded.",
  );
});

test("prerenders the cards the built fragment ships", async () => {
  // The build renders this fragment with no window at all, so the pane has no
  // query to read and must publish the cards themselves.
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<HomeCardsPage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();

  document.body.innerHTML = html;
  const pane = screen.getByRole("region", { name: "Areas of work" });
  expect(within(pane).getAllByRole("article")).toHaveLength(3);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
