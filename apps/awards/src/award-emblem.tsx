export type AwardIcon = "cfa" | "gmat" | "scholarship" | "student" | "teaching";

function LaurelBranch({ mirrored = false }: { mirrored?: boolean }) {
  const leaves = [
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
  ] as const;
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

function Icon({ type }: { type: AwardIcon }) {
  if (type === "gmat")
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
  if (type === "cfa")
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
  if (type === "student")
    return (
      <g fill="#20262b" transform="translate(74 60) rotate(-7 25 34)">
        <path d="M8 52 L42 18 L54 30 L20 64 L5 67 Z" />
        <path d="M43 15 L50 8 Q55 3 61 9 L66 14 Q71 20 65 25 L58 32 Z" />
        <path d="M10 53 L19 62 L9 65 Z" fill="#fff" />
        <path d="M22 52 L48 26" fill="none" stroke="#fff" strokeWidth="4" />
      </g>
    );
  if (type === "scholarship")
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

export function AwardEmblem({ icon }: { icon: AwardIcon }) {
  return (
    <svg className="award-emblem" viewBox="0 0 200 150" aria-hidden="true">
      <LaurelBranch />
      <LaurelBranch mirrored />
      <Icon type={icon} />
    </svg>
  );
}
