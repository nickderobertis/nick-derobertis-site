import { cvDataClient } from "@site/data-access";
export default function BioPage() {
  return (
    <section className="hero">
      <p className="eyebrow">Nick DeRobertis</p>
      <h1>Biography</h1>
      <p>Professor, researcher, and open-source software developer.</p>
      <output className="placeholder">
        Biography remote loaded · {cvDataClient.domain("timeline").length}{" "}
        timeline entries
      </output>
    </section>
  );
}
