import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SpikeIcon, spikeContact } from "./spike-icons";
const headerLinks = spikeContact;
export type NavRoute = { path: string; label: string };
export function SiteLayout({
  routes,
  children,
}: {
  routes: NavRoute[];
  children: ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span className="brand-logo" aria-hidden="true" />
            <span>Nick DeRobertis</span>
          </Link>
          <nav aria-label="Primary">
            <ul className="nav-list">
              {routes.map((r) => (
                <li key={r.path}>
                  <Link
                    className="nav-link"
                    to={r.path}
                    activeProps={{ "aria-current": "page" }}
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ul className="header-icons" aria-label="Contact">
            {headerLinks.map((c) => (
              <li key={c.icon}>
                <a className="header-icon" href={c.href} aria-label={c.label}>
                  <SpikeIcon name={c.icon} size={20} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </header>
      <main className="main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <span>© {new Date().getFullYear()} Nick DeRobertis</span>
          <ul className="footer-icons" aria-label="Contact links">
            {headerLinks.map((c) => (
              <li key={c.icon}>
                <a href={c.href} aria-label={c.label}>
                  <SpikeIcon name={c.icon} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
