// One-time setup explicitly authorized for the existing validation branch.
// Writes a generated credential to an owner-only temporary file, never stdout/Git.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) throw new Error("Provide the authorized Vercel CLI configuration directory.");
const project = "prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd";
const branch = "validacao-coexistence";
function api(path, body) {
  try {
    return JSON.parse(execFileSync("vercel", ["api", path, "--scope", "booster7", "--global-config", directory, "--raw", ...(body ? ["--method", "POST", "--input", "-"] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }));
  } catch { throw new Error("Vercel request failed. Secret values not logged."); }
}
const metadata = api(`/v9/projects/${project}`);
if (metadata.name !== "sunrise-celebrations" || metadata.accountId !== "team_mPe8xExFqM8kDUXnwemjSbSQ") throw new Error("Unexpected project/account.");
const { envs } = api(`/v9/projects/${project}/env`);
if (!envs.some(env => env.key === "WHATSAPP_SYSTEM_USER_ID" && env.target?.includes("preview") && (!env.gitBranch || env.gitBranch === branch))) throw new Error("Existing technical actor must be configured first.");
if (envs.some(env => env.key.startsWith("META_REVIEWER_") && env.gitBranch === branch)) throw new Error("Reviewer configuration already exists. Refusing to rotate or overwrite it.");
const password = randomBytes(32).toString("base64url");
const signingKey = randomBytes(48).toString("base64url");
const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
const privateDirectory = mkdtempSync(join(tmpdir(), "sunrise-meta-reviewer-"));
const credentialFile = join(privateDirectory, "credentials.json");
writeFileSync(credentialFile, JSON.stringify({ username: "meta-review", password, expiresAt, signingKey }, null, 2), { flag: "wx", mode: 0o600 });
console.log(`Private recovery file: ${credentialFile}`);
const values = {
  META_REVIEWER_PASSWORD_SHA256: createHash("sha256").update(password).digest("hex"),
  META_REVIEWER_SIGNING_KEY: signingKey,
  META_REVIEWER_EXPIRES_AT: expiresAt,
  // Activate last so a partial configuration fails closed.
  META_REVIEWER_ENABLED: "true",
};
for (const [key, value] of Object.entries(values)) {
  api(`/v10/projects/${project}/env`, { key, value, type: key.endsWith("SHA256") || key.endsWith("SIGNING_KEY") ? "sensitive" : "encrypted", target: ["preview"], gitBranch: branch });
  console.log(`${key}: branch Preview configured; Production unchanged`);
}
console.log(`Expires: ${expiresAt}. Redeploy required. Do not share the signing key; only the username/password belong in reviewer instructions.`);
