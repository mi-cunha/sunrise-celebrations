// Authorized setup for the single Sunrise validation branch. Secret output is
// sent only to the local clipboard for the Meta form, never stdout or Git.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const [authDirectory, operation] = process.argv.slice(2);
if (!authDirectory || !["create-verify-token", "check-verify-token", "copy-callback"].includes(operation)) throw new Error("Explicit CLI login and supported operation required.");
const project = "prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd";
const common = ["--scope", "booster7", "--global-config", authDirectory, "--raw"];
function api(path, method = "GET", body) {
  try {
    return JSON.parse(execFileSync("vercel", ["api", path, ...common, ...(body ? ["--method", method, "--input", "-"] : [])], {
      input: body ? JSON.stringify(body) : undefined, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 30000,
    }));
  } catch { throw new Error(`Vercel ${method} failed. No secret values logged.`); }
}
const metadata = api(`/v9/projects/${project}`);
if (metadata.name !== "sunrise-celebrations" || metadata.accountId !== "team_mPe8xExFqM8kDUXnwemjSbSQ") throw new Error("Wrong Vercel project/account.");
if (operation === "create-verify-token") {
  const { envs } = api(`/v9/projects/${project}/env`);
  if (envs.some((env) => env.key === "WHATSAPP_VERIFY_TOKEN" && env.gitBranch === "validacao-coexistence" && env.target?.includes("preview"))) throw new Error("Preview token already exists. Refusing implicit rotation.");
  const value = randomBytes(32).toString("hex");
  api(`/v10/projects/${project}/env`, "POST", { key: "WHATSAPP_VERIFY_TOKEN", value, type: "sensitive", target: ["preview"], gitBranch: "validacao-coexistence" });
  execFileSync("pbcopy", { input: value, stdio: ["pipe", "pipe", "pipe"] });
  console.log("Preview-only verify token created and copied for the Meta form. Production unchanged. Redeploy required.");
} else {
  const bypass = Object.entries(metadata.protectionBypass ?? {}).find(([, value]) => value.scope === "automation-bypass")?.[0];
  if (!bypass) throw new Error("No authorized automation bypass configured.");
  const url = new URL("https://sunrise-celebrations-git-validacao-coexistence-booster7.vercel.app/api/whatsapp/webhook");
  url.searchParams.set("x-vercel-protection-bypass", bypass);
  if (operation === "check-verify-token") {
    const token = execFileSync("pbpaste", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Clipboard is not the generated verification token. No request sent.");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", token);
    url.searchParams.set("hub.challenge", "sunrise-validation-challenge");
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      if (response.status !== 200 || await response.text() !== "sunrise-validation-challenge") throw new Error();
      console.log("PASS: protected preview returned HTTP 200 and the exact verification challenge. No Meta configuration changed.");
    } catch { throw new Error("Verification challenge failed. No secret values logged."); }
  } else {
    execFileSync("pbcopy", { input: url.href, stdio: ["pipe", "pipe", "pipe"] });
    console.log("Protected preview callback copied for the Meta form. No callback was changed by this script.");
  }
}
