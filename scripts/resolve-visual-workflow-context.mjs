import { readFileSync } from "node:fs";

const [eventName, repository, headSha] = process.argv.slice(2);
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? ""))
  throw new Error("Repository must be an owner/repository name");
if (!/^[0-9a-f]{40}$/.test(headSha ?? ""))
  throw new Error("Head SHA must be a full lowercase commit SHA");
if (eventName === "push") {
  process.stdout.write("event_name=push\npr_number=\nbase_ref=\n");
  process.exit(0);
}
if (eventName !== "pull_request") throw new Error("Unsupported source event");
const input = readFileSync(0);
if (input.length > 1024 * 1024)
  throw new Error("Pull-request response is too large");
const pulls = JSON.parse(input.toString("utf8"));
if (!Array.isArray(pulls))
  throw new Error("Pull-request response must be an array");
const matches = pulls.filter(
  (pull) =>
    typeof pull === "object" &&
    pull !== null &&
    pull.state === "open" &&
    pull.head?.sha === headSha &&
    pull.base?.repo?.full_name === repository,
);
if (matches.length !== 1)
  throw new Error("Expected exactly one matching open pull request");
const [{ number, base }] = matches;
if (!Number.isSafeInteger(number) || number < 1)
  throw new Error("Pull-request number is invalid");
if (
  typeof base.ref !== "string" ||
  !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(base.ref)
)
  throw new Error("Pull-request base ref is invalid");
process.stdout.write(
  `event_name=pull_request\npr_number=${number}\nbase_ref=${base.ref}\n`,
);
