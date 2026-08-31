import { remoteConfig } from "@site/build-config";

// The workspace's federation graph parser reads this declaration. Awards'
// build target itself runs rsbuild.config.ts through TanStack Start.
export default remoteConfig("awards", { skeleton: true });
