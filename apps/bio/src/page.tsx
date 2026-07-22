import "@site/design-system";
import "./bio.css";
import type { RouteView } from "@site/route-state";
import { useBioView } from "./use-bio-view";

function Marker({ children }: { children: string }) {
  return <span aria-hidden="true">{children}</span>;
}

function Biography() {
  return (
    <article className="bio-page" aria-labelledby="bio-heading">
      <div className="bio-cover" aria-hidden="true" />
      <div className="bio-content">
        <h1 id="bio-heading">Optimizing Life</h1>

        <section aria-labelledby="early-days">
          <h2 id="early-days">Early Days</h2>
          <p>
            I was born and raised in Virginia and from an early age I realized I
            only had limited time on this planet. Since then I have sought every
            day to maximize my impact on the world and get the most enjoyment
            out of life.
          </p>
        </section>

        <section aria-labelledby="philosophy">
          <h2 id="philosophy">Philosophy</h2>
          <h3>
            Continuous Learning, Innovation, and Open Collaboration{" "}
            <Marker>💡</Marker>
          </h3>
          <p>
            When taking on a project, I always try to learn something new and
            usually develop some tools along the way. In trying to maximize my
            impact, I have open-sourced{" "}
            <a href="https://github.com/nickderobertis">many of these tools</a>.
            My hope is that the net productivity gain to the finance, data
            science, and software development industries from open-sourcing
            these tools will be far greater than the amount of work I could
            produce alone. If everyone agrees to collaborate openly rather than
            keeping tools or knowledge for themselves or teams then society will
            be much better off as a whole.
          </p>

          <h3>
            Reproducible Research <Marker>♻</Marker>
          </h3>
          <p>
            Another reason for my focus on software and automation is because I
            believe we would gain much more understanding of finance if our
            research studies were consistently open and reproducible.
          </p>

          <h4 className="bio-problem">
            The Problem <Marker>▲</Marker>
          </h4>
          <p>
            Our studies often require complex manipulations of data for
            cleaning, merging, aggregating, analyzing, and visualizing. A
            research project that completes all of its stages from raw data to
            publication and presentation, in well-organized, modular, readable
            code currently easily spans tens of thousands of lines of code.
            Asking someone who also needs to know statistics, econometrics,
            economic theory, visualization, writing, and presentation to learn
            the level of software engineering skill currently required to
            execute this is too much of a burden for most.
          </p>

          <h4 className="bio-solution">
            The Solution <Marker>✓</Marker>
          </h4>
          <p>
            Automation, open source software, and version control are the keys
            to this future. An empirical research project should be able to run
            from the raw data sources to the full analysis, publication, and
            presentation by executing a single line of code and this is how I
            structure all my projects. The code and data should be submitted
            along with a journal submission and the reviewer should reproduce
            the results and inspect the code and data.
          </p>
          <p>
            To make our research reproducible, some empirical researchers need
            to put a greater focus on software which automates the more
            difficult parts of the process and share it openly with the world.
            Then research projects could be completed with far less code and be
            automatically reproducible. I hope to do my part towards this end
            while also completing research and teaching.
          </p>
        </section>

        <section aria-labelledby="day-to-day">
          <h2 id="day-to-day">Day to Day</h2>
          <p>
            I spend most of my time researching finance topics, teaching, and
            building these tools, but when I get some extra time I love to work
            with my hands and experience the outdoors. I have been maintaining
            our family&apos;s vehicles since 2009 and take any chance I can get
            to go hiking or camping. My wife and I are currently traveling
            around the U.S. with our cat and dog.
          </p>
        </section>
      </div>
    </article>
  );
}

function BioState({ state }: { state: "empty" | "error" | "loading" }) {
  const content = {
    empty: ["Biography coming soon", "There is no biography to show yet."],
    error: ["Biography unavailable", "The biography could not be displayed."],
    loading: ["Loading biography", "Preparing Nick's story…"],
  } as const;
  const [heading, detail] = content[state];
  return (
    <section
      className="bio-state"
      role={state === "error" ? "alert" : "status"}
    >
      <h1>{heading}</h1>
      <p>{detail}</p>
    </section>
  );
}

export default function BioPage({ initialView }: { initialView?: RouteView }) {
  // llmlint: ignore-block[changed_behavior_has_e2e] bio.spec.ts drives happy, loading, empty, and error query states through both host-composed and standalone URLs.
  const scenario = useBioView(initialView);
  if (scenario === "loading") return <BioState state="loading" />;
  if (scenario === "empty" || scenario === "error")
    return <BioState state={scenario} />;
  // llmlint: ignore-end[changed_behavior_has_e2e]
  return <Biography />;
}
