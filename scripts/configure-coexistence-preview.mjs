// Uses an explicitly selected Vercel CLI login. Never prints environment values.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const authDirectory = process.argv[2];
if (!authDirectory) throw new Error("Pass the authorized Vercel CLI configuration directory.");
const project = "prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd";
const branch = "validacao-coexistence";
const common = ["--scope", "booster7", "--global-config", authDirectory, "--raw"];
function api(path, method = "GET", body) {
  try {
    const output = execFileSync("vercel", ["api", path, ...common, ...(body ? ["--method", method, "--input", "-"] : [])], {
      input: body ? JSON.stringify(body) : undefined, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(output);
  } catch { throw new Error(`Vercel operation failed: ${method} ${path}. No credential values logged.`); }
}
const metadata = api(`/v9/projects/${project}`);
if (metadata.name !== "sunrise-celebrations" || metadata.accountId !== "team_mPe8xExFqM8kDUXnwemjSbSQ") throw new Error("Wrong Vercel project/account.");
const { envs } = api(`/v9/projects/${project}/env`);
// Vercel cannot read sensitive values back. Extend only these existing secrets'
// target list, keeping their values and Production availability unchanged.
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_APP_SECRET", "WHATSAPP_SYSTEM_USER_ID", "WHATSAPP_VERIFY_TOKEN"]) {
  const existing = envs.find((env) => env.key === key && env.target?.includes("production"));
  if (!existing || existing.gitBranch) throw new Error(`Unexpected Production variable: ${key}`);
  if (!existing.target.includes("preview")) api(`/v9/projects/${project}/env/${existing.id}`, "PATCH", { target: [...existing.target, "preview"] });
  console.log(`${key}: Production preserved; Preview enabled`);
}
const values = {
  NEXT_PUBLIC_META_APP_ID: "1966660290718855",
  NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: "4473682106181135",
  WHATSAPP_ALLOWED_WABA_ID: "1800002930569834",
  WHATSAPP_ALLOWED_PHONE_NUMBER_ID: "631897616670252",
  WHATSAPP_GRAPH_API_VERSION: "v26.0",
  WHATSAPP_REVIEW_ENABLED: "false",
  WHATSAPP_CREDENTIAL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
};
for (const [key, value] of Object.entries(values)) {
  const existing = envs.find((env) => env.key === key && env.target?.includes("preview") && env.gitBranch === branch);
  if (existing) { console.log(`${key}: existing branch value preserved`); continue; }
  api(`/v10/projects/${project}/env`, "POST", { key, value, type: key === "WHATSAPP_CREDENTIAL_ENCRYPTION_KEY" ? "sensitive" : "encrypted", target: ["preview"], gitBranch: branch });
  console.log(`${key}: branch Preview configured`);
}
