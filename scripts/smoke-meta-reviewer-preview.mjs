// Test login boundaries only. Never sends messages or creates templates.
// Secrets remain in memory and are never included in diagnostic output.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const [authDirectory, credentialFile, deploymentHost] = process.argv.slice(2);
if (!authDirectory || !credentialFile || !/^sunrise-celebrations-[a-z0-9-]+-booster7\.vercel\.app$/.test(deploymentHost ?? "")) throw new Error("Authorized CLI config, private credential file and explicit Sunrise preview host required.");
const credentials = JSON.parse(readFileSync(credentialFile, "utf8"));
const project = JSON.parse(execFileSync("vercel", ["api", "/v9/projects/prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd", "--scope", "booster7", "--global-config", authDirectory, "--raw"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const bypass = Object.entries(project.protectionBypass ?? {}).find(([, value]) => value.scope === "automation-bypass")?.[0];
if (!bypass) throw new Error("Internal preview testing requires the existing authorized automation token.");
const origin = `https://${deploymentHost}`;
let failures = 0;
function check(name, valid) { console.log(`${valid ? "PASS" : "FAIL"} ${name}`); failures += valid ? 0 : 1; }
async function request(path, options = {}) {
  return fetch(`${origin}${path}`, { ...options, redirect: "manual", signal: AbortSignal.timeout(45000), headers: { "x-vercel-protection-bypass": bypass, ...options.headers } });
}
function decode(value) { return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
function loginForm(html, password) {
  const body = new FormData();
  for (const input of html.matchAll(/<input\b[^>]*>/g)) {
    const attrs = Object.fromEntries([...input[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])]));
    if (attrs.type === "hidden" && attrs.name) body.append(attrs.name, attrs.value ?? "");
  }
  if (![...body.keys()].some(key => key.startsWith("$ACTION_"))) throw new Error("Login action not found; no credential posted.");
  body.set("username", credentials.username); body.set("password", password); return body;
}
const anonymous = await request("/avaliacao-meta"); const html = await anonymous.text();
check("anonymous reviewer page shows login, not demo controls", anonymous.status === 200 && html.includes("Senha de avaliação") && !html.includes("Destinatário autorizado pela equipe:"));
check("reviewer page suppresses referrers and indexing", anonymous.headers.get("referrer-policy") === "no-referrer" && anonymous.headers.get("x-robots-tag")?.includes("noindex"));
const wrong = await request("/avaliacao-meta", { method: "POST", headers: { Origin: origin }, body: loginForm(html, "invalid-fixture-password") });
check("incorrect password cannot create a reviewer session", !(wrong.headers.get("set-cookie") ?? "").includes("sunrise_meta_review=") && (await wrong.text()).includes("Credencial inválida"));
const foreign = await request("/avaliacao-meta", { method: "POST", headers: { Origin: "https://foreign.example" }, body: loginForm(html, "invalid-fixture-password") });
check("foreign-origin action is rejected", foreign.status >= 400 && !(foreign.headers.get("set-cookie") ?? "").includes("sunrise_meta_review=")); await foreign.body?.cancel();
const valid = await request("/avaliacao-meta", { method: "POST", headers: { Origin: origin }, body: loginForm(html, credentials.password) });
const cookieHeader = valid.headers.getSetCookie().find(value => value.startsWith("sunrise_meta_review="));
check("valid login creates secure isolated cookie", valid.status === 303 && Boolean(cookieHeader?.includes("HttpOnly") && cookieHeader.includes("Secure") && cookieHeader.includes("Path=/avaliacao-meta")));
await valid.body?.cancel();
if (cookieHeader) {
  const cookie = cookieHeader.split(";")[0];
  const demo = await request("/avaliacao-meta", { headers: { Cookie: cookie } }); const demoHtml = await demo.text();
  check("reviewer sees only the manual demonstration", demo.status === 200 && demoHtml.includes("Sair da avaliação") && !demoHtml.includes('href="/crm"') && !demoHtml.includes('href="/atendimentos"'));
  console.log(`Meta test credential: ${demoHtml.includes("credencial de teste expirou") ? "INVALID_OR_EXPIRED — renewal required" : demoHtml.includes("Remetente oficial de teste:") ? "VALID (read-only check)" : "NOT VERIFIED"}`);
  for (const path of ["/crm", "/admin/opcoes", "/admin/whatsapp-avaliacao", "/api/whatsapp/connect", "/avaliacao-meta/admin"]) {
    const response = await request(path, { headers: { Cookie: cookie } });
    const redirect = new URL(response.headers.get("location") ?? "/", origin);
    check(`reviewer cookie cannot access ${path}`, response.status === 307 && redirect.origin === origin && redirect.pathname === "/login"); await response.body?.cancel();
  }
  const logoutInput = demoHtml.match(/<input type="hidden" name="(\$ACTION_ID_[^"]+)"/);
  if (logoutInput) {
    const body = new FormData(); body.set(logoutInput[1], "");
    const logout = await request("/avaliacao-meta", { method: "POST", headers: { Cookie: cookie, Origin: origin }, body });
    check("logout clears the isolated cookie", logout.status === 303 && (logout.headers.get("set-cookie") ?? "").includes("Max-Age=0")); await logout.body?.cancel();
  } else check("logout action present", false);
}
if (failures) process.exitCode = 1;
