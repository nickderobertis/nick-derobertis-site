import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    basepath:
      typeof window === "undefined"
        ? "/"
        : "/nick-derobertis-site/remotes/awards/",
  });
}
