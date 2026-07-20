import { cvDataClient } from "@site/data-access";
export default function SoftwarePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Nick DeRobertis</p>
      <h1>Software</h1>
      <p>Open-source tools for finance, research, and Python.</p>
      <output className="placeholder">
        Software remote loaded ·{" "}
        {cvDataClient.domain("software_projects").length} projects
      </output>
    </section>
  );
}
