import { type Award, loadAwards, selectAwards } from "@site/data-access";
import "@site/design-system";
import { useCallback, useEffect, useState } from "react";

type AwardsLoadState =
  | { status: "loading" }
  | { status: "loaded"; awards: Award[] }
  | { status: "error" };

function useAwardsData() {
  const [state, setState] = useState<AwardsLoadState>({ status: "loading" });
  const refresh = useCallback(() => {
    setState({ status: "loading" });
    void loadAwards()
      .then((awards) => setState({ status: "loaded", awards }))
      .catch(() => setState({ status: "error" }));
  }, []);
  useEffect(refresh, [refresh]);
  return { refresh, state };
}

function awardInfo(award: Award): {
  extraInfo?: string;
  parts: string[];
} {
  const [extraInfo, ...parts] = award.details
    ? award.details
        .split("|")
        .map((part) => part.trim().replaceAll("\\$", "$"))
        .filter(Boolean)
    : [];
  return { extraInfo, parts };
}

function AwardCard({ award }: { award: Award }) {
  const { extraInfo, parts } = awardInfo(award);
  return (
    <article className="award-card">
      <p className="award-date">{award.received_label ?? "Date unavailable"}</p>
      <div className="award-mark" aria-hidden="true">
        ★
      </div>
      <h3>{award.title}</h3>
      {extraInfo ? <p className="award-extra-info">{extraInfo}</p> : null}
      {parts.length > 0 ? (
        <ul className="award-parts" aria-label="Award parts">
          {parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function AwardsStats({ awards }: { awards: Award[] }) {
  const detailedAwards = awards.filter(
    (award) => awardInfo(award).extraInfo !== undefined,
  );
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

function isSelectedAwardsPane(): boolean {
  return /\/nick-derobertis-site\/?$/.test(window.location.pathname);
}

export default function AwardsPage() {
  const { refresh, state } = useAwardsData();
  const selected = isSelectedAwardsPane();
  const Heading = selected ? "h2" : "h1";
  const awards =
    state.status === "loaded" && selected
      ? selectAwards(state.awards)
      : state.status === "loaded"
        ? state.awards
        : [];
  return (
    <section className="awards-pane" aria-labelledby="awards-heading">
      <header className="awards-heading">
        <p className="eyebrow">Recognition</p>
        <Heading id="awards-heading">Awards</Heading>
        <p>Academic, professional, and community recognition.</p>
      </header>
      {state.status === "loading" ? (
        <div className="awards-state" role="status">
          Loading awards…
        </div>
      ) : state.status === "error" ? (
        <div className="awards-state awards-state-error" role="alert">
          <h2>Awards are unavailable</h2>
          <p>Please try again later.</p>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : awards.length === 0 ? (
        <div className="awards-state" role="status">
          <h2>No awards to show</h2>
          <p>New recognition will appear here.</p>
        </div>
      ) : (
        <AwardsCollection awards={awards} />
      )}
    </section>
  );
}
