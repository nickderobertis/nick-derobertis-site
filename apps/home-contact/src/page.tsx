import { homeContent, readPaneState } from "@site/data-access-home";
import { PageShell, SectionHeading } from "@site/design-system";
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
    <PageShell
      className="contact-pane"
      contained
      aria-labelledby="contact-title"
    >
      <div className="contact-copy">
        <SectionHeading
          eyebrow="Contact"
          title={homeContent.contact.title}
          titleId="contact-title"
          description={homeContent.contact.description}
        />
      </div>
      <nav className="contact-links" aria-label="Contact options">
        {homeContent.contact.links.map((link) => (
          <a href={link.href} key={link.label}>
            {link.label} →
          </a>
        ))}
      </nav>
    </PageShell>
  );
}
