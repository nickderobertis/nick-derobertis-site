import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * How long an async query — `findBy*`, `waitFor` — may wait for the element it
 * names. Testing Library's own default is one second, and that second is spent
 * on work these specs really do inside it: a host spec renders a page that
 * suspends on one dynamic import per pane, and `vi.resetModules()` makes every
 * one of those module graphs evaluate again for each test. Whether a second is
 * enough is then decided by how loaded the machine is rather than by anything
 * the page does, and when it is not, the query reports the pane as absent from
 * a composition that is correct.
 *
 * Stating it here takes that decision away from the host's load. It is kept
 * under Vitest's own five-second default test timeout, which is the smallest
 * ceiling any project in this workspace runs under, so an element that never
 * arrives is still reported by name beside the DOM that lacked it rather than
 * as a test that ran out of time.
 */
configure({ asyncUtilTimeout: 4_000 });

// Testing Library registers this teardown itself only when Vitest injects its
// globals, and this workspace runs without them. Without it every render stays
// mounted, so the next test in the file queries the previous test's markup too.
afterEach(cleanup);
