import { createFileRoute } from "@tanstack/react-router";
import AwardsPage from "../../src/page";

export const Route = createFileRoute("/")({ component: AwardsPage });
