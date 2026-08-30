import { createElement, type HTMLAttributes } from "react";
import { classNames } from "./class-names";
import { elementProps } from "./element-props";

export interface PageShellProps extends HTMLAttributes<HTMLElement> {
  /**
   * The element the shell renders. A route that is one document uses an
   * `article`, a pane of a larger page uses a `section`, and a host that only
   * stacks other remotes' panes uses a `div`.
   */
  as?: "section" | "article" | "div";
  /**
   * Whether the shell holds itself to the site's reading width. A pane that
   * bleeds to the viewport edge paints its own background and leaves this off.
   */
  contained?: boolean;
}

const own = ["as", "contained", "className"];

/**
 * The container a route or pane mounts into. It establishes the positioning
 * context every pane's absolutely positioned parts — carousel controls, chart
 * details, banner glyphs — are placed against, so a pane never has to
 * re-declare that to make its own overlay land inside it.
 */
export function PageShell(props: PageShellProps) {
  const { as = "section", contained = false, className } = props;
  return createElement(
    as,
    elementProps(
      props,
      own,
      classNames("pane", contained && "pane-contained", className),
    ),
  );
}
