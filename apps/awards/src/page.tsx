import { type Award, cvDataClient } from "@site/data-access";
import "@site/design-system";
import { useEffect, useState } from "react";

type AwardsView = "all" | "selected" | "empty" | "error" | "loading";

const selectedAwardIds = new Set([
  "warrington-college-of-business-ph-d-student-teaching-award",
  "graduate-management-admission-test-gmat-score",
  "cfa-global-investment-research-challenge-global-semi-finalist",
  "finance-student-of-the-year",
]);

function defaultView(): AwardsView {
  return window.location.pathname.includes("/remotes/awards/")
    ? "all"
    : "selected";
}

function requestedView(): AwardsView {
  const value = new URLSearchParams(window.location.search).get("awards-view");
  if (
    value === "all" ||
    value === "selected" ||
    value === "empty" ||
    value === "error" ||
    value === "loading"
  )
    return value;
  return defaultView();
}

function useAwardsView(): AwardsView {
  const [view, setView] = useState<AwardsView>(requestedView);
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setView(defaultView()), 1_500);
    return () => window.clearTimeout(timer);
  }, [view]);
  return view;
}

const viewOptions: ReadonlyArray<{ label: string; view: AwardsView }> = [
  { label: "Selected awards", view: "selected" },
  { label: "All awards", view: "all" },
  { label: "Loading state", view: "loading" },
  { label: "Empty state", view: "empty" },
  { label: "Unavailable state", view: "error" },
];

function AwardsViewControls({ view }: { view: AwardsView }) {
  return (
    <nav className="awards-view-controls" aria-label="Awards display options">
      {viewOptions.map((option) => (
        <a
          key={option.view}
          href={`?awards-view=${option.view}`}
          aria-current={view === option.view ? "page" : undefined}
        >
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function awardParts(award: Award): string[] {
  return award.details
    ? award.details
        .split("|")
        .map((part) => part.trim().replaceAll("\\$", "$"))
        .filter(Boolean)
    : [];
}

function AwardCard({ award }: { award: Award }) {
  const parts = awardParts(award);
  return (
    <article className="award-card">
      <p className="award-date">{award.received_label ?? "Date unavailable"}</p>
      <div className="award-mark" aria-hidden="true">
        ★
      </div>
      <h3>{award.title}</h3>
      {parts.length > 0 ? (
        <ul className="award-parts" aria-label="Award details">
          {parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function AwardsStats({ awards }: { awards: Award[] }) {
  const detailedAwards = awards.filter((award) => awardParts(award).length > 0);
  const receivedLabels = new Set(
    awards.map((award) => award.received_label).filter(Boolean),
  );
  return (
    <dl className="awards-stats" aria-label="Awards statistics">
      <div>
        <dt>Awards shown</dt>
        <dd>{awards.length}</dd>
      </div>
      <div>
        <dt>Received periods</dt>
        <dd>{receivedLabels.size}</dd>
      </div>
      <div>
        <dt>With extra info</dt>
        <dd>{detailedAwards.length}</dd>
      </div>
    </dl>
  );
}

function AwardsCollection({ awards }: { awards: Award[] }) {
  return (
    <>
      <AwardsStats awards={awards} />
      <section className="awards-grid" aria-label="Awards list">
        {awards.map((award) => (
          <AwardCard key={award.id} award={award} />
        ))}
      </section>
    </>
  );
}

export default function AwardsPage() {
  const view = useAwardsView();
  const allAwards = cvDataClient.domain("awards");
  const awards =
    view === "selected"
      ? allAwards.filter((award) => selectedAwardIds.has(award.id))
      : allAwards;
  return (
    <section className="awards-pane" aria-labelledby="awards-heading">
      <header className="awards-heading">
        <p className="eyebrow">Recognition</p>
        <h2 id="awards-heading">Awards</h2>
        <p>Academic, professional, and community recognition.</p>
      </header>
      <AwardsViewControls view={view} />
      {view === "loading" ? (
        <div className="awards-state" role="status">
          Loading awards…
        </div>
      ) : view === "error" ? (
        <div className="awards-state awards-state-error" role="alert">
          <h3>Awards are unavailable</h3>
          <p>Please try again later.</p>
        </div>
      ) : view === "empty" ? (
        <div className="awards-state" role="status">
          <h3>No awards to show</h3>
          <p>New recognition will appear here.</p>
        </div>
      ) : (
        <AwardsCollection awards={awards} />
      )}
    </section>
  );
}
