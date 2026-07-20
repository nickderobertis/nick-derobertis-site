import { z } from "zod";

const paneStateSchema = z.enum(["happy", "empty", "loading", "error"]);

export type PaneState = z.infer<typeof paneStateSchema>;

export function readPaneState(search: string): PaneState {
  const value = new URLSearchParams(search).get("state") ?? "happy";
  return paneStateSchema.catch("error").parse(value);
}

export const homeContent = {
  carousel: [
    {
      title: "Finance researcher & educator",
      description:
        "Empirical finance research, practical courses, and tools that make complex ideas useful.",
      link: "/research",
      linkLabel: "View research",
      tone: "research",
    },
    {
      title: "Serial founder & full-stack software engineer",
      description:
        "Building web applications and maintaining open-source packages for researchers and teams.",
      link: "/software",
      linkLabel: "Software projects",
      tone: "software",
    },
  ],
  cards: [
    {
      icon: "⚙",
      title: "Engineering",
      description:
        "I turn hard problems into approachable, open-source software tools.",
      link: "/software",
      linkLabel: "View software",
    },
    {
      icon: "◆",
      title: "Teaching",
      description:
        "I teach practical finance, programming, and data skills at the university level.",
      link: "/courses",
      linkLabel: "View courses",
    },
    {
      icon: "▥",
      title: "Research",
      description:
        "My empirical work explores financial markets and cryptocurrency valuation.",
      link: "/research",
      linkLabel: "View research",
    },
  ],
  story: {
    eyebrow: "My story",
    title: "Who am I?",
    description:
      "I am a finance Ph.D., serial entrepreneur, engineer, and product leader. I enjoy creating software, researching financial markets, and sharing useful ideas with the world.",
    link: "/bio",
    linkLabel: "View bio",
  },
  contact: {
    title: "Let’s build something useful.",
    description:
      "Have a research, teaching, or software question? Choose a public channel and get in touch.",
    links: [
      {
        label: "Email Nick",
        href: "mailto:derobertis.nick@gmail.com",
      },
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/nickderobertis/",
      },
      { label: "GitHub", href: "https://github.com/nickderobertis" },
    ],
  },
} as const;
