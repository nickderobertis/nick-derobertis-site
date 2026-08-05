import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library registers this teardown itself only when Vitest injects its
// globals, and this workspace runs without them. Without it every render stays
// mounted, so the next test in the file queries the previous test's markup too.
afterEach(cleanup);
