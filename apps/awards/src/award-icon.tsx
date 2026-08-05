/**
 * Every mark this component can draw, declared as values and not only as a
 * type, so anything that has to cover all of them reads this one list instead
 * of restating it. The const assertion is what the single declaration rests on:
 * without it these names widen to `string` and `AwardIconName` can no longer
 * derive from them.
 */
export const awardIconNames = [
  "cfa",
  "gmat",
  "scholarship",
  "student",
  "teaching",
] as const;

export type AwardIconName = (typeof awardIconNames)[number];

/**
 * The mark an emblem centres between its laurel branches. Each award kind gets
 * a distinct drawing, and `teaching` is the fallback so an emblem always has a
 * mark to centre.
 */
export function AwardIcon({ name }: { name: AwardIconName }) {
  if (name === "gmat")
    return (
      <g transform="translate(53 67)">
        <text
          x="0"
          y="33"
          fill="#192126"
          fontFamily="Arial"
          fontSize="38"
          fontWeight="700"
        >
          G
        </text>
        <text
          x="31"
          y="33"
          fill="#192126"
          fontFamily="Arial"
          fontSize="31"
          fontWeight="700"
        >
          MAT
        </text>
        <rect x="3" y="39" width="23" height="4" fill="#f2ca00" />
        <text x="103" y="10" fill="#192126" fontFamily="Arial" fontSize="7">
          ™
        </text>
      </g>
    );
  if (name === "cfa")
    return (
      <g transform="translate(100 87)">
        {[
          "north",
          "one",
          "two",
          "three",
          "four",
          "south",
          "six",
          "seven",
          "eight",
          "nine",
        ].map((key, index) => (
          <path
            key={key}
            d="M0 -7 L10 -35 L18 -31 L8 -3 Z"
            fill={["#00a779", "#008bd0", "#536ac5"][index % 3]}
            transform={`rotate(${index * 36})`}
          />
        ))}
      </g>
    );
  if (name === "student")
    return (
      <g fill="#20262b" transform="translate(74 60) rotate(-7 25 34)">
        <path d="M8 52 L42 18 L54 30 L20 64 L5 67 Z" />
        <path d="M43 15 L50 8 Q55 3 61 9 L66 14 Q71 20 65 25 L58 32 Z" />
        <path d="M10 53 L19 62 L9 65 Z" fill="#fff" />
        <path d="M22 52 L48 26" fill="none" stroke="#fff" strokeWidth="4" />
      </g>
    );
  if (name === "scholarship")
    return (
      <text
        x="100"
        y="111"
        textAnchor="middle"
        fill="#20262b"
        fontFamily="Georgia"
        fontSize="55"
        fontWeight="700"
      >
        $
      </text>
    );
  return (
    <g fill="#20262b" transform="translate(59 65)">
      <path d="M0 24 L41 8 L82 24 L41 40 Z" />
      <path d="M17 35 Q41 48 65 35 L62 55 Q41 66 20 55 Z" />
      <path d="M5 27 L5 49" fill="none" stroke="#20262b" strokeWidth="5" />
      <circle cx="5" cy="52" r="4" />
    </g>
  );
}
