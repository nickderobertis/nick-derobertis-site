// eslint-disable-next-line @nx/enforce-module-boundaries -- This stand-in remote mirrors the validated payload the shell owns at its route boundary, for the shell's own tests.
import type { SoftwareProjects } from "@site/data-access-core";
import type { SoftwarePageProps } from "@site/route-state";

export default function SoftwarePage({
  initialView,
  projects,
}: SoftwarePageProps<SoftwareProjects>) {
  return (
    <article aria-label="Software remote">
      <h1>Open-Source Software</h1>
      <p>view: {initialView ?? "default"}</p>
      <p>projects: {projects ? projects.length : "none"}</p>
    </article>
  );
}
