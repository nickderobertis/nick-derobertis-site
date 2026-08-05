// Each leaf is its own placement because the wreath is drawn, not generated:
// the spacing tightens toward the tip so the branch reads as laurel rather than
// as a repeated stamp.
const leaves: readonly (readonly [x: number, y: number, rotate: number])[] = [
  [34, 122, -54],
  [27, 111, -48],
  [22, 99, -41],
  [19, 86, -34],
  [18, 73, -25],
  [20, 60, -15],
  [24, 48, -7],
  [30, 37, 5],
  [38, 28, 18],
  [47, 21, 30],
];

/**
 * One half of the emblem's laurel wreath. The emblem draws it twice, mirroring
 * the second copy, so the two halves can never drift apart.
 */
export function LaurelBranch({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <g transform={mirrored ? "translate(200 0) scale(-1 1)" : undefined}>
      <path
        d="M20 136 C19 91 32 48 59 16"
        fill="none"
        stroke="#8a5510"
        strokeWidth="3"
      />
      {leaves.map(([x, y, rotate]) => (
        <ellipse
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          rx="4"
          ry="11"
          fill="#087817"
          transform={`rotate(${rotate} ${x} ${y})`}
        />
      ))}
    </g>
  );
}
