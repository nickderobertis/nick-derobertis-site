import { createElement, type HTMLAttributes } from "react";
import { classNames } from "./class-names";
import { elementProps } from "./element-props";

export type PaneStateProps = HTMLAttributes<HTMLElement>;

const own = ["className"];

/**
 * What a pane shows instead of its content when there is none to show. It
 * renders an `output`, whose implicit `status` role announces the replacement
 * politely: a visitor asked for the page, not for this pane, so neither an
 * empty record set nor an unreachable one interrupts what they came for.
 */
export function PaneState(props: PaneStateProps) {
  return createElement(
    "output",
    elementProps(props, own, classNames("pane-state", props.className)),
  );
}
