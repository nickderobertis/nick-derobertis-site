import type { SoftwareProject } from "@site/data-access-core";
import "@site/design-system";
import type { SoftwarePageProps } from "@site/route-state";
import "./software.css";
import Skeleton from "./skeleton";
import { SoftwareCollection } from "./software-collection";
import { useSoftwarePage } from "./use-software-page";

export default function SoftwarePage({
  initialView,
  projects: initialProjects,
}: SoftwarePageProps<SoftwareProject[]>) {
  const { projects, view } = useSoftwarePage(initialView, initialProjects);
  return (
    <section className="software-page">
      <header className="software-banner">
        <p className="eyebrow">Nick DeRobertis</p>
        <h1>Open-Source Software</h1>
        <p>
          I am a strong believer in free and open-source software. Explore my
          projects for finance, research, data, and Python.
        </p>
      </header>
      {view === "loading" ? (
        <Skeleton />
      ) : view === "error" ? (
        <div className="software-state software-state-error" role="alert">
          <h2>Software projects are unavailable</h2>
          <p>Please try again later.</p>
        </div>
      ) : view === "empty" ? (
        <div className="software-state" role="status">
          <h2>No software projects to show</h2>
          <p>New open-source work will appear here.</p>
        </div>
      ) : (
        <SoftwareCollection projects={projects} />
      )}
    </section>
  );
}
