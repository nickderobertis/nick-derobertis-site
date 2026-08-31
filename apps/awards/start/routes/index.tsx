import { createFileRoute } from "@tanstack/react-router";
import { committedAwards } from "../../src/committed-awards";
import AwardsPage from "../../src/page";

export const Route = createFileRoute("/")({
  loader: () => committedAwards,
  component: AwardsRoute,
});

function AwardsRoute() {
  return (
    <AwardsPage initialAwards={Route.useLoaderData()} initialShowAll={false} />
  );
}
