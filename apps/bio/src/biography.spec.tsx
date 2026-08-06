import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { Biography } from "./biography";

test("titles the story and lays it out under its three chapter headings", () => {
  render(<Biography />);

  const story = screen.getByRole("article", { name: "Optimizing Life" });
  expect(
    within(story).getByRole("heading", { level: 1, name: "Optimizing Life" }),
  ).toBeInTheDocument();
  expect(
    within(story)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(["Early Days", "Philosophy", "Day to Day"]);
  // Each chapter names the region it heads, so a reader can jump between them.
  expect(
    within(story)
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-labelledby")),
  ).toEqual(["early-days", "philosophy", "day-to-day"]);
});

test("tells the story a visitor came to read", () => {
  render(<Biography />);

  expect(screen.getByText(/born and raised in Virginia/)).toBeInTheDocument();
  expect(
    screen.getByText(
      /research studies were consistently open and reproducible/,
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/traveling around the U\.S\./)).toBeInTheDocument();
});

test("sends a reader to the open-source work the story credits", () => {
  render(<Biography />);

  expect(
    screen.getByRole("link", { name: "many of these tools" }),
  ).toHaveAttribute("href", "https://github.com/nickderobertis");
});

test("announces the philosophy sub-headings without their decorative glyphs", () => {
  render(<Biography />);

  // Every one of these carries a Marker, so an accessible name that still reads
  // cleanly is what proves the glyphs stayed out of the accessibility tree.
  expect(
    screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent?.trim()),
  ).toEqual([
    "Continuous Learning, Innovation, and Open Collaboration 💡",
    "Reproducible Research ♻",
  ]);
  expect(
    screen.getByRole("heading", {
      level: 3,
      name: "Continuous Learning, Innovation, and Open Collaboration",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 4, name: "The Problem" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 4, name: "The Solution" }),
  ).toBeInTheDocument();
});
