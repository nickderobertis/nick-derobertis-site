import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AwardIcon, type AwardIconName } from "./award-icon";

const iconNames: ReadonlyArray<AwardIconName> = [
  "cfa",
  "gmat",
  "scholarship",
  "student",
  "teaching",
];

function drawIcon(name: AwardIconName) {
  const { container } = render(
    // The emblem the mark really sits in is decoration, so this stand-in host
    // keeps it out of the accessibility tree the same way.
    <svg viewBox="0 0 200 150" aria-hidden="true">
      <AwardIcon name={name} />
    </svg>,
  );
  const drawing = container.querySelector("svg");
  if (!drawing) throw new Error(`AwardIcon drew nothing for ${name}`);
  return drawing;
}

test("letters the two marks that a visitor reads rather than recognises", () => {
  drawIcon("gmat");
  expect(screen.getByText("G")).toBeInTheDocument();
  expect(screen.getByText("MAT")).toBeInTheDocument();
  expect(screen.getByText("™")).toBeInTheDocument();

  drawIcon("scholarship");
  expect(screen.getByText("$")).toBeInTheDocument();
});

test("cycles the CFA blades through the challenge's three colours", () => {
  const blades = [...drawIcon("cfa").querySelectorAll("path")];

  expect(blades).toHaveLength(10);
  expect(new Set(blades.map((blade) => blade.getAttribute("fill")))).toEqual(
    new Set(["#00a779", "#008bd0", "#536ac5"]),
  );
});

test("draws a different mark for every award kind", () => {
  // A card is only recognisable by its mark, so two kinds sharing a drawing is
  // the failure this locks out — including the fallback silently swallowing a
  // kind it should have drawn.
  const drawings = iconNames.map((name) => drawIcon(name).innerHTML);

  expect(new Set(drawings).size).toBe(iconNames.length);
  expect(drawings.every((drawing) => drawing.length > 0)).toBe(true);
});
