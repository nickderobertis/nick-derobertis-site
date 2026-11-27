// SPIKE MOCK (throwaway): hand-drawn stand-ins for the live site's Font Awesome
// icons. Inline SVG, decoration only, never larger than 32x32 CSS px.
const paths: Record<string, string> = {
  envelope: "M3 6h18v12H3z M3 6l9 7 9-7",
  phone: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z",
  "map-marker": "M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z M12 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5",
  linkedin: "M3 3h18v18H3z M7 10v7 M7 7v.5 M11 17v-7 M11 13a3 3 0 0 1 6 0v4",
  github: "M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21",
  cogs: "M9 5.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z M9 2v2 M9 14v2 M3 9h2 M13 9h2 M4.8 4.8l1.4 1.4 M11.8 11.8l1.4 1.4 M4.8 13.2l1.4-1.4 M11.8 6.2l1.4-1.4 M17 15a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M17 12.5v1 M17 21v1 M14 17.5h1 M19.5 17.5h1",
  "graduation-cap": "M2 9l10-5 10 5-10 5z M6 11v5c3 2.5 9 2.5 12 0v-5 M22 9v6",
  "chart-bar": "M3 3v18h18 M7 17v-6 M12 17V7 M17 17v-9",
  building: "M5 21V3h14v18 M3 21h18 M9 7h2 M13 7h2 M9 11h2 M13 11h2 M9 15h2 M13 15h2 M11 21v-3h2v3",
  filter: "M3 4h18l-7 9v6l-4 2v-8z",
  "info-circle": "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z M12 11v6 M12 7.5v.5",
  "book-open": "M2 5c3-1.5 7-1.5 10 1 3-2.5 7-2.5 10-1v14c-3-1.5-7-1.5-10 1-3-2.5-7-2.5-10-1z M12 6v14",
  lightbulb: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  recycle: "M7 19H4l3-5 M9 8l3-5 3 5 M20 15l-1.5 4H14 M7 14l-2.5-4.5 M15 8l3 5 M14 19l-3-3 3-3",
  "exclamation-triangle": "M12 3l10 18H2z M12 10v5 M12 17.5v.5",
  "check-circle": "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z M8 12l3 3 5-6",
  microchip: "M6 6h12v12H6z M9 9h6v6H9z M9 3v3 M15 3v3 M9 18v3 M15 18v3 M3 9h3 M3 15h3 M18 9h3 M18 15h3",
  book: "M5 4a2 2 0 0 1 2-2h12v17H7a2 2 0 0 0-2 2z M5 21a2 2 0 0 0 2 1h12v-3",
  tasks: "M3 5l1.5 1.5L7 4 M3 12l1.5 1.5L7 11 M3 19l1.5 1.5L7 18 M10 5h11 M10 12h11 M10 19h11",
};
export type SpikeIconName = keyof typeof paths;
export function SpikeIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`spike-icon ${className ?? ""}`} width={Math.min(size, 32)} height={Math.min(size, 32)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name] ?? ""} />
    </svg>
  );
}
export const spikeContact = [
  { icon: "envelope", label: "derobertis.nick@gmail.com", href: "mailto:derobertis.nick@gmail.com" },
  { icon: "phone", label: "(703) 828-4709", href: "tel:+17038284709" },
  { icon: "map-marker", label: "Carbon Health, 55 Pacific Ave, San Francisco, CA 94111", href: "" },
  { icon: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/nick-derobertis/" },
  { icon: "github", label: "GitHub", href: "https://github.com/nickderobertis" },
];
