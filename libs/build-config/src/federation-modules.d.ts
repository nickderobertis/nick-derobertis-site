// remoteConfig exposes this dependency-light contract for every remote, so
// hosts do not maintain a second per-remote Skeleton module inventory.
declare module "*/Skeleton" {
  import type { ComponentType } from "react";

  const Skeleton: ComponentType;
  export default Skeleton;
}
