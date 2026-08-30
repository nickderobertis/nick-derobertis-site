import { type AnchorHTMLAttributes, createElement } from "react";
import { classNames } from "./class-names";
import { elementProps } from "./element-props";

export interface ActionLinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Where the action goes. An action link always leads somewhere. */
  href: string;
}

const own = ["className"];

/**
 * The affordance that leaves the current pane for somewhere else. Its focus
 * ring is part of the primitive rather than of each pane, so no adopter can
 * ship an action a keyboard visitor cannot see themselves land on.
 */
export function ActionLink(props: ActionLinkProps) {
  return createElement(
    "a",
    elementProps(props, own, classNames("action", props.className)),
  );
}
