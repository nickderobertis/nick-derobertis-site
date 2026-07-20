import { cvDataClient } from "@site/data-access";
import "@site/design-system";
import { useEffect, useState } from "react";

type BioView = "default" | "empty" | "error" | "loading";

function requestedView(): BioView {
  const value = new URLSearchParams(window.location.search).get("bio-view");
  return value === "empty" || value === "error" || value === "loading"
    ? value
    : "default";
}

function useBioView(): BioView {
  const [view, setView] = useState<BioView>(() => requestedView());
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView("default"), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return view;
}

function Story() {
  const timeline = cvDataClient.domain("timeline");
  const doctorate = timeline.find(
    (entry) => entry.kind === "education" && entry.short_degree === "Ph.D.",
  );
  const organizations = new Set(
    timeline
      .filter((entry) => entry.kind !== "education")
      .map((entry) => entry.organization),
  );

  return (
    <article className="bio-story" aria-label="Nick DeRobertis's story">
      <section className="bio-cover" aria-label="Biography cover">
        <div className="bio-cover-content">
          <p className="eyebrow">The story so far</p>
          <h1>Optimizing Life</h1>
          <p>
            Finance professor, researcher, entrepreneur, and open-source
            software developer.
          </p>
          <dl className="bio-facts" aria-label="Biography highlights">
            <div>
              <dt>Doctorate</dt>
              <dd>{doctorate?.organization ?? "University of Florida"}</dd>
            </div>
            <div>
              <dt>Career</dt>
              <dd>{organizations.size} organizations</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="bio-prose" aria-label="Biography prose">
        <section>
          <h2>Early Days</h2>
          <p>
            I was born and raised in Virginia and from an early age I realized I
            only had limited time on this planet. Since then I have sought every
            day to maximize my impact on the world and get the most enjoyment
            out of life.
          </p>
        </section>

        <section>
          <h2>Philosophy</h2>
          <h3>Continuous Learning, Innovation, and Open Collaboration</h3>
          <p>
            When taking on a project, I always try to learn something new and
            usually develop some tools along the way. In trying to maximize my
            impact, I have open-sourced many of these tools. My hope is that the
            net productivity gain to the finance, data science, and software
            development industries from open-sourcing these tools will be far
            greater than the amount of work I could produce alone. If everyone
            agrees to collaborate openly rather than keeping tools or knowledge
            for themselves or teams, then society will be much better off as a
            whole.
          </p>
        </section>

        <section>
          <h2>Reproducible Research</h2>
          <p>
            Another reason for my focus on software and automation is because I
            believe we would gain much more understanding of finance if our
            research studies were consistently open and reproducible.
          </p>
          <h3 className="bio-problem">The Problem</h3>
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
          <h3 className="bio-solution">The Solution</h3>
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

        <section>
          <h2>Day to Day</h2>
          <p>
            I spend most of my time researching finance topics, teaching, and
            building these tools, but when I get some extra time I love to work
            with my hands and experience the outdoors. I have been maintaining
            our family’s vehicles since 2009 and take any chance I can get to go
            hiking or camping. My wife and I are currently traveling around the
            U.S. with our cat and dog.
          </p>
        </section>
      </section>
    </article>
  );
}

export default function BioPage() {
  const view = useBioView();
  if (view === "loading")
    return (
      <div className="bio-state" role="status">
        Loading biography…
      </div>
    );
  if (view === "error")
    return (
      <div className="bio-state bio-state-error" role="alert">
        <h1>Biography unavailable</h1>
        <p>Please try again later.</p>
      </div>
    );
  if (view === "empty")
    return (
      <div className="bio-state" role="status">
        <h1>Biography coming soon</h1>
        <p>There is no story to show yet.</p>
      </div>
    );
  return <Story />;
}
