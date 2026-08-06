// The sunburst is drawn in a 500-unit square, so every ring is measured from
// its centre and 12 o'clock is the zero angle a reader expects.
const CENTRE = 250;

/** The point on the chart at `radius` units from the centre, `angle` degrees clockwise from 12 o'clock. */
export function point(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [
    CENTRE + radius * Math.cos(radians),
    CENTRE + radius * Math.sin(radians),
  ];
}

/**
 * The path for one sunburst sector: the wedge between two radii and two angles.
 * A sector wider than a half turn needs SVG's large-arc flag, or the renderer
 * draws the short way round and the sector collapses into its own complement.
 */
export function arc(inner: number, outer: number, start: number, end: number) {
  const [a, b] = point(outer, start);
  const [c, d] = point(outer, end);
  const [e, f] = point(inner, end);
  const [g, h] = point(inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${a} ${b} A ${outer} ${outer} 0 ${large} 1 ${c} ${d} L ${e} ${f} A ${inner} ${inner} 0 ${large} 0 ${g} ${h} Z`;
}
