import { homeContent, readPaneState } from "@site/data-access-home";

export default function HomeContactPage() {
  const state = readPaneState(window.location.search);
  if (state === "loading")
    return <output className="pane-state">Loading contact options…</output>;
  if (state === "error")
    return (
      <output className="pane-state">
        Contact options could not be loaded.
      </output>
    );
  if (state === "empty")
    return (
      <output className="pane-state">No contact options are available.</output>
    );
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
