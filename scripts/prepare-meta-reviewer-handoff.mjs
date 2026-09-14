// Build private reviewer-only handoff text and verify the link without SSO.
// No Meta key, Vercel automation bypass, signing key, or CRM credential is shared.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const [credentialFile] = process.argv.slice(2);
if (!credentialFile) throw new Error("Private reviewer credential file required.");
const credentials = JSON.parse(readFileSync(credentialFile, "utf8"));
const share = JSON.parse(readFileSync(join(dirname(credentialFile), "share-response.json"), "utf8"));
const entry = Object.entries(share.protectionBypass ?? {}).find(([, value]) => value.scope === "shareable-link");
if (!entry || entry[1].expires * 1000 <= Date.now()) throw new Error("Valid branch share link missing.");
const origin = "https://sunrise-celebrations-git-validacao-coexistence-booster7.vercel.app";
const url = new URL("/avaliacao-meta", origin); url.searchParams.set("_vercel_share", entry[0]);
let next = url; const jar = new Map(); let reachedLogin = false;
for (let hop = 0; hop < 5; hop++) {
  if (next.origin !== origin) throw new Error("Unexpected redirect; secret not forwarded.");
  const response = await fetch(next, { redirect: "manual", signal: AbortSignal.timeout(45000), headers: jar.size ? { Cookie: [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ") } : {} });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0]; const separator = pair.indexOf("="); jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) { next = new URL(location, origin); await response.body?.cancel(); continue; }
  const html = await response.text();
  reachedLogin = response.status === 200 && html.includes("Senha de avaliação") && !html.includes("Sair da avaliação"); break;
}
if (!reachedLogin) throw new Error("Share link did not reach isolated login. Handoff not created.");
const file = join(dirname(credentialFile), "reviewer-handoff.json");
writeFileSync(file, JSON.stringify({ url: url.toString(), username: credentials.username, password: credentials.password, expiresAt: credentials.expiresAt,
  accessText: `Não há pagamento ou assinatura para avaliação. Acesso exclusivo ao painel isolado: usuário ${credentials.username}; senha ${credentials.password}. Credencial e link válidos até ${credentials.expiresAt.slice(0, 10)}. A sessão dura até uma hora; entre novamente se necessário. Este acesso não autoriza consultar dados reais do CRM.`,
}, null, 2), { flag: "wx", mode: 0o600 });
console.log(`PASS: external share link reaches isolated login without Vercel or CRM authentication. Private handoff: ${file}`);
