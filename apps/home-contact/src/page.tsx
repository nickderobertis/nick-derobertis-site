import { homeContent, readPaneState } from "@site/data-access-home";
import { ContactState } from "./contact-state";
import Skeleton from "./skeleton";
import "./contact.css";

export default function HomeContactPage() {
  const state = readPaneState(
    typeof window === "undefined" ? "" : window.location.search,
  );
  if (state === "loading") return <Skeleton />;
  if (state !== "happy") return <ContactState name={state} />;
  return (
    <section className="pane contact-pane" aria-labelledby="contact-title">
      <div className="contact-copy">
        <p className="eyebrow">Contact</p>
        <h2 id="contact-title">{homeContent.contact.title}</h2>
        <p>{homeContent.contact.description}</p>
      </div>
      <nav className="contact-links" aria-label="Contact options">
        {homeContent.contact.links.map((link) => (
          <a href={link.href} key={link.label}>
            {link.label} →
          </a>
        ))}
      </nav>
    </section>
  );
}
