import { execFileSync } from "node:child_process";

const [authDirectory, deploymentHost] = process.argv.slice(2);
if (!authDirectory || !/^sunrise-celebrations-[a-z0-9-]+-booster7\.vercel\.app$/.test(deploymentHost ?? "")) throw new Error("Explicit Sunrise preview host and authorized CLI configuration required.");
const project = JSON.parse(execFileSync("vercel", ["api", "/v9/projects/prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd", "--scope", "booster7", "--global-config", authDirectory, "--raw"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }));
const bypass = Object.entries(project.protectionBypass ?? {}).find(([, value]) => value.scope === "automation-bypass")?.[0];
if (!bypass) throw new Error("No authorized automation access token configured for this project.");
// Only public/login and deliberately rejected API requests. No business data writes.
const checks = [
  { path: "/login", status: 200 },
  { path: "/politica-de-privacidade", status: 200 },
  // The application's auth proxy rejects these before route-level checks run.
  { path: "/api/whatsapp/connect", status: 307, location: "/login" },
  { path: "/api/whatsapp/webhook", status: 403 },
  { path: "/api/whatsapp/webhook", status: 401, method: "POST", body: { object: "whatsapp_business_account", entry: [] } },
  { path: "/api/whatsapp/sync", status: 307, location: "/login", method: "POST", body: { confirm: true }, origin: "https://foreign.example" },
];
let failed = false;
for (const check of checks) {
  const response = await fetch(`https://${deploymentHost}${check.path}`, {
    method: check.method ?? "GET", redirect: "manual", signal: AbortSignal.timeout(30000),
    headers: { "x-vercel-protection-bypass": bypass, "Content-Type": "application/json", ...(check.origin ? { Origin: check.origin } : {}) },
    ...(check.body ? { body: JSON.stringify(check.body) } : {}),
  });
  const location = response.headers.get("location");
  const redirect = location ? new URL(location, `https://${deploymentHost}`) : undefined;
  // Vercel may preserve internal query parameters. Validate origin/path without
  // printing or following a redirect that could contain an automation secret.
  const validRedirect = !check.location || (redirect?.origin === `https://${deploymentHost}` && redirect.pathname === check.location);
  const ok = response.status === check.status && validRedirect;
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${check.method ?? "GET"} ${check.path}: HTTP ${response.status} (expected ${check.status})`);
  if (!ok && redirect) {
    console.log(`Redirect destination (without query): ${redirect.origin}${redirect.pathname}`);
  }
  await response.body?.cancel();
}
if (failed) process.exitCode = 1;
