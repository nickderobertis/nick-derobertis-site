import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
            Nick DeRobertis
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
        </div>
      </header>
      <main className="main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          © {new Date().getFullYear()} Nick DeRobertis
        </div>
      </footer>
    </>
  );
}
