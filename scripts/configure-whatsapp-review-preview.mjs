// Branch-only demo setup. JSON input on stdin; never log secret values.
// Input: {"recipient":"country-code-and-digits","token":"Meta-test-token"}
// Omit both fields to prepare the disabled demo without changing credentials.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const directory = process.argv[2];
if (!directory) throw new Error("Provide the authorized Vercel CLI configuration directory.");
const raw = readFileSync(0, "utf8").trim();
let input;
try { input = raw ? JSON.parse(raw) : {}; } catch { throw new Error("Invalid JSON input. Values not logged."); }
const activate = typeof input.token === "string" && input.token.length >= 20 && typeof input.recipient === "string" && /^[1-9]\d{9,14}$/.test(input.recipient);
if ((input.token || input.recipient) && !activate) throw new Error("Provide both the test token and authorized recipient, or neither.");
const project = "prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd";
const branch = "validacao-coexistence";
function api(path, body, method = "POST") {
  try {
    return JSON.parse(execFileSync("vercel", ["api", path, "--scope", "booster7", "--global-config", directory, "--raw", ...(body ? ["--method", method, "--input", "-"] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }));
  } catch { throw new Error("Vercel request failed. No secret values logged."); }
}
const metadata = api(`/v9/projects/${project}`);
if (metadata.name !== "sunrise-celebrations" || metadata.accountId !== "team_mPe8xExFqM8kDUXnwemjSbSQ") throw new Error("Unexpected project/account.");
const { envs } = api(`/v9/projects/${project}/env`);
const values = {
  WHATSAPP_REVIEW_WABA_ID: "915488050924122",
  WHATSAPP_REVIEW_PHONE_NUMBER_ID: "1158464910693095",
  ...(activate ? { WHATSAPP_REVIEW_ACCESS_TOKEN: input.token, WHATSAPP_REVIEW_RECIPIENT: input.recipient } : {}),
  ...(activate ? { WHATSAPP_REVIEW_ENABLED: "true" } : {}),
};
for (const [key, value] of Object.entries(values)) {
  const existing = envs.find(env => env.key === key && env.gitBranch === branch && env.target?.includes("preview"));
  const type = ["WHATSAPP_REVIEW_ACCESS_TOKEN", "WHATSAPP_REVIEW_RECIPIENT"].includes(key) ? "sensitive" : "encrypted";
  if (existing) api(`/v9/projects/${project}/env/${existing.id}`, { value, type }, "PATCH");
  else api(`/v10/projects/${project}/env`, { key, value, type, target: ["preview"], gitBranch: branch });
  console.log(`${key}: branch Preview configured; Production unchanged`);
}
console.log(activate ? "Demo configuration saved. Redeploy and validate sandbox ownership before sending." : "Test asset IDs prepared. No credential or activation flag changed.");
