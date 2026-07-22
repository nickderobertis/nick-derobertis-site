declare module "home/Page" {
  import type { ComponentType } from "react";

  const Page: ComponentType<Record<string, unknown>>;
  export default Page;
}
declare module "bio/Page" {
  import type { BioPageProps } from "@site/route-state";
  import type { ComponentType } from "react";

  const Page: ComponentType<BioPageProps>;
  export default Page;
}
declare module "research/Page" {
  // The shell owns this route boundary and its validated loader payload.
  // eslint-disable-next-line @nx/enforce-module-boundaries
  import type { Research } from "@site/data-access-core";
  import type { ResearchPageProps } from "@site/route-state";
  import type { ComponentType } from "react";

  const Page: ComponentType<ResearchPageProps<Research>>;
  export default Page;
}
declare module "software/Page" {
  // The shell owns this route boundary and its validated loader payload.
  // eslint-disable-next-line @nx/enforce-module-boundaries
  import type { SoftwareProjects } from "@site/data-access-core";
  import type { SoftwarePageProps } from "@site/route-state";
  import type { ComponentType } from "react";

  const Page: ComponentType<SoftwarePageProps<SoftwareProjects>>;
  export default Page;
}
declare module "courses/Page" {
  // The shell owns this route boundary and its validated loader payload.
  // eslint-disable-next-line @nx/enforce-module-boundaries
  import type { Courses } from "@site/data-access-core";
  import type { CoursesPageProps } from "@site/route-state";
  import type { ComponentType } from "react";

  const Page: ComponentType<CoursesPageProps<Courses>>;
  export default Page;
}

declare module "timeline/Page" {
  import type { ComponentType } from "react";

  const Page: ComponentType;
  export default Page;
}
