import { createElement, type HTMLAttributes } from "react";
import { classNames } from "./class-names";
import { elementProps } from "./element-props";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * The element the card renders. A card that stands on its own is an
   * `article`; one that is an item of a list is an `li`.
   */
  as?: "article" | "section" | "div" | "li";
}

const own = ["as", "className"];

/**
 * One padded surface carrying one record. The surface itself — its padding,
 * border, radius, background and shadow — is stated once here and read from
 * `--card-*` tokens, so a pane whose cards are round, tinted or flat sets those
 * tokens instead of restating what a card is.
 */
export function Card(props: CardProps) {
  const { as = "article", className } = props;
  return createElement(
    as,
    elementProps(props, own, classNames("card", className)),
  );
}
