import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
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
          <NavLink className="brand" to="/">
            Nick DeRobertis
          </NavLink>
          <nav aria-label="Primary">
            <ul className="nav-list">
              {routes.map((r) => (
                <li key={r.path}>
                  <NavLink className="nav-link" to={r.path}>
                    {r.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          © {new Date().getFullYear()} Nick DeRobertis
        </div>
      </footer>
    </>
  );
}
