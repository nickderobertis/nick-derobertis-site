import { render, screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { beforeEach, expect, test, vi } from "vitest";
import HomeContactPage from "./page";

function visit(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  return render(<HomeContactPage />);
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

test("invites a visitor to get in touch", () => {
  visit("");

  const pane = screen.getByRole("region", {
    name: "Let’s build something useful.",
  });
  expect(within(pane).getByText("Contact")).toBeInTheDocument();
  expect(
    within(pane).getByText(/Have a research, teaching, or software question/),
  ).toBeInTheDocument();
});

test("offers every public channel through one labelled group", () => {
  visit("");

  const channels = screen.getByRole("navigation", { name: "Contact options" });
  expect(
    within(channels)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual([
    "mailto:derobertis.nick@gmail.com",
    "https://www.linkedin.com/in/nickderobertis/",
    "https://github.com/nickderobertis",
  ]);
  expect(
    within(channels).getByRole("link", { name: "Email Nick →" }),
  ).toBeInTheDocument();
});

test("holds its loading frame while a visitor previews that state", () => {
  visit("?state=loading");

  expect(
    screen.getByRole("status", { name: "Loading contact options" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

test("reports a missing channel list instead of an empty group", () => {
  visit("?state=empty");

  expect(screen.getByRole("status")).toHaveTextContent(
    "No contact options are available.",
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("reports an unreadable channel list", () => {
  visit("?state=error");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Contact options could not be loaded.",
  );
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

test("treats a query it does not publish as an unreadable channel list", () => {
  visit("?state=whatever");

  expect(screen.getByRole("status")).toHaveTextContent(
    "Contact options could not be loaded.",
  );
});

test("prerenders the contact options the built fragment ships", async () => {
  // The build renders this fragment with no window at all, so the pane has no
  // query to read and must publish the channels themselves.
  vi.stubGlobal("window", undefined);
  const { prelude } = await prerender(<HomeContactPage />);
  const html = await new Response(prelude).text();
  vi.unstubAllGlobals();

  document.body.innerHTML = html;
  expect(
    within(
      screen.getByRole("navigation", { name: "Contact options" }),
    ).getAllByRole("link"),
  ).toHaveLength(3);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
