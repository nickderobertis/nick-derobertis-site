import { createElement, type HTMLAttributes, type ReactNode } from "react";
import { classNames } from "./class-names";
import { elementProps } from "./element-props";

export interface SectionHeadingProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** What the section is called. */
  title: ReactNode;
  /** The id the section points its own `aria-labelledby` at. */
  titleId?: string;
  /** The heading rank, so a heading nested in a route does not skip a level. */
  level?: 1 | 2 | 3;
  /** The short label above the title: a kind, a count, or a category. */
  eyebrow?: ReactNode;
  /** The sentence under the title. */
  description?: ReactNode;
}

const own = [
  "title",
  "titleId",
  "level",
  "eyebrow",
  "description",
  "className",
  "children",
];

/**
 * The heading that opens a section: an optional eyebrow, the title, and an
 * optional description, in that order and at the rank the caller names. Every
 * pane that opened a section had its own copy of this — a paragraph, a heading,
 * and a paragraph, each styled where it stood — so a change to how a section
 * announces itself was a change in every pane.
 */
export function SectionHeading(props: SectionHeadingProps) {
  const {
    title,
    titleId,
    level = 2,
    eyebrow,
    description,
    className,
    children,
  } = props;
  // The parts are passed as separate arguments rather than as one array, so
  // React reads them as this heading's fixed shape rather than as a list whose
  // items would each owe a key.
  return createElement(
    "header",
    elementProps(props, own, classNames("section-heading", className)),
    eyebrow === undefined
      ? null
      : createElement("p", { className: "eyebrow" }, eyebrow),
    createElement(
      `h${level}`,
      { className: "section-title", id: titleId },
      title,
    ),
    description === undefined
      ? null
      : createElement("p", { className: "section-description" }, description),
    children,
  );
}
