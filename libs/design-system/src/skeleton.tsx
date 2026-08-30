import { createElement, type HTMLAttributes } from "react";
import { classNames } from "./class-names";
import { elementProps } from "./element-props";

export interface SkeletonProps extends HTMLAttributes<HTMLElement> {
  /** The element the skeleton renders, matching the pane it stands in for. */
  as?: "section" | "article" | "div";
  /** What is loading, announced to a visitor who cannot see the shimmer. */
  label: string;
}

const own = ["as", "label", "className"];

/**
 * The shimmering stand-in a remote renders while its page loads. The shimmer,
 * its reduced-motion opt-out, and the parts a pane lays out — `skeleton-grid`,
 * `skeleton-list`, `skeleton-split`, and the block shapes inside them — are
 * published with it, so a pane declares only the sizes that are its own.
 */
export function Skeleton(props: SkeletonProps) {
  const { as = "section", label, className } = props;
  const attributes = elementProps(
    props,
    own,
    classNames("remote-skeleton", className),
  );
  attributes.role = "status";
  attributes["aria-label"] = label;
  return createElement(as, attributes);
}
