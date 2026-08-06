import { expect, test } from "vitest";
import { arc, point } from "./chart-geometry";

const CENTRE = 250;

function radius([x, y]: readonly (number | undefined)[]) {
  // Trigonometry leaves a corner a few ulps off its ring; a visitor sees the
  // ring, so the comparison is made at the precision a renderer draws at.
  return Number(
    Math.hypot((x ?? Number.NaN) - CENTRE, (y ?? Number.NaN) - CENTRE).toFixed(
      6,
    ),
  );
}

/**
 * Reads a sector back out of the path it is drawn as. Only the corners, the two
 * ring radii, and the large-arc flag say anything about the shape a visitor
 * sees, so those are what this exposes.
 */
function sector(inner: number, outer: number, start: number, end: number) {
  const parts = arc(inner, outer, start, end).split(" ");
  const at = (index: number) => Number(parts[index]);
  return {
    commands: [0, 3, 11, 14, 22].map((index) => parts[index]),
    corners: [
      [at(1), at(2)],
      [at(9), at(10)],
      [at(12), at(13)],
      [at(20), at(21)],
    ],
    largeArcFlags: [parts[7], parts[18]],
    radii: [at(4), at(5), at(15), at(16)],
  };
}

test("measures the chart from its centre, with the zero angle at twelve o'clock", () => {
  expect(point(0, 137)).toEqual([CENTRE, CENTRE]);
  const [top, right] = [point(100, 0), point(100, 90)];

  expect(top[0]).toBeCloseTo(250);
  expect(top[1]).toBeCloseTo(150);
  expect(right[0]).toBeCloseTo(350);
  expect(right[1]).toBeCloseTo(250);
});

test("closes a wedge whose corners sit on the two rings it spans", () => {
  const wedge = sector(125, 245, 10, 80);

  expect(wedge.commands).toEqual(["M", "A", "L", "A", "Z"]);
  expect(wedge.radii).toEqual([245, 245, 125, 125]);
  expect(wedge.corners.map(radius)).toEqual([245, 245, 125, 125]);
});

test("draws a sector wider than a half turn the long way round", () => {
  // Without the large-arc flag the renderer takes the short way between the same
  // two corners, and the sector comes out as its own complement.
  expect(sector(0, 245, 0, 181).largeArcFlags).toEqual(["1", "1"]);
  expect(sector(0, 245, 0, 180).largeArcFlags).toEqual(["0", "0"]);
});
