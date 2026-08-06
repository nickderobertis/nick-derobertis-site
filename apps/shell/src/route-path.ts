import { routes } from "./routes";

/**
 * The path the route manifest publishes a route at. Routes are named by label
 * everywhere in the shell so a path can be changed in routes.json alone; a
 * label the manifest does not carry is a wiring mistake, and failing here names
 * it rather than leaving the router with an undefined path.
 */
export const routePath = (label: string) => {
  const route = routes.find((item) => item.label === label);
  if (!route)
    throw new Error(
      `Missing ${label} route in routes.json. Add the route to apps/shell/src/routes.json and rerun just check.`,
    );
  return route.path;
};
