// The specifiers the alias specs map, declared the way an app declares the
// remotes it composes, so the importer beside this file typechecks against the
// stand-ins rather than against `any`.
declare module "panes/card" {
  export const resolved: string;
}

declare module "panes/card/list" {
  export const resolved: string;
}

declare module "skeletons/*" {
  export const resolved: string;
}
