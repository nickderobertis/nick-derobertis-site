import { captureVisualSuite } from "../../../libs/visual-harness/src/index.ts";
import { suite } from "./scenarios.ts";

await captureVisualSuite(suite, process.argv[2] ?? "");
