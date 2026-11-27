import { homeContent, readPaneState } from "@site/data-access-home";
// eslint-disable-next-line @nx/enforce-module-boundaries -- The app deliberately initializes this shared library asynchronously at startup; this primitive still must be a static component dependency.
import { PageShell, SectionHeading, SpikeIcon, spikeContact } from "@site/design-system";
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
          description="Reach out by email or phone, or connect on LinkedIn and GitHub."
        />
      </div>
      <nav className="contact-links" aria-label="Contact options">
        <ul className="contact-details">
          {spikeContact.map((c) => (
            <li key={c.icon}>
              <SpikeIcon name={c.icon} size={22} />
              <a href={c.href}>{c.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </PageShell>
  );
}
