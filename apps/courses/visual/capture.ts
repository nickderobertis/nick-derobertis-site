import { captureVisualSuite } from "@site/visual-harness";
import { suite } from "./scenarios.ts";

await captureVisualSuite(suite, process.argv[2] ?? "");
