import { SiteLayout } from "@site/layout";
import { Navigate, Route, Routes } from "react-router-dom";
import { routes } from "./routes";
export function App() {
  return (
    <SiteLayout routes={routes.map(({ path, label }) => ({ path, label }))}>
      <Routes>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <section className="hero">
                <p className="eyebrow">Nick DeRobertis</p>
                <h1>{route.heading}</h1>
                <p>{route.description}</p>
                <output className="placeholder">
                  Content remote coming soon
                </output>
              </section>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SiteLayout>
  );
}
