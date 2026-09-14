// Explicitly authorized branch-only share link. Does not change project protection.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const [authDirectory, credentialFile] = process.argv.slice(2);
if (!authDirectory || !credentialFile) throw new Error("Authorized CLI config and private credential file required.");
const credentials = JSON.parse(readFileSync(credentialFile, "utf8"));
const host = "sunrise-celebrations-git-validacao-coexistence-booster7.vercel.app";
function api(path, body) {
  try { return JSON.parse(execFileSync("vercel", ["api", path, "--scope", "booster7", "--global-config", authDirectory, "--raw", ...(body ? ["--method", "PATCH", "--input", "-"] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })); }
  catch { throw new Error("Share API failed; no secrets logged. Inspect existing link state before retrying."); }
}
const alias = api(`/v4/aliases/${host}`);
if (alias.alias !== host || alias.projectId !== "prj_Go2RA42p6Rs8ijqTk5tzn17LIIRd") throw new Error("Unexpected preview alias.");
const deployment = api(`/v13/deployments/${alias.deploymentId}`);
if (deployment.readyState !== "READY" || deployment.meta?.githubCommitRef !== "validacao-coexistence" || deployment.target === "production") throw new Error("Validation deployment not ready.");
if (Object.values(alias.protectionBypass ?? {}).some(entry => entry.scope === "shareable-link")) throw new Error("A share link already exists. Refusing to replace it.");
const ttl = Math.floor((Date.parse(credentials.expiresAt) - Date.now()) / 1000);
if (ttl < 3600) throw new Error("Reviewer credential expires too soon.");
const result = api(`/aliases/${alias.uid ?? alias.id}/protection-bypass`, { ttl });
// Preserve the response privately so an uncertain schema never triggers a duplicate mutation.
const resultFile = join(dirname(credentialFile), "share-response.json");
writeFileSync(resultFile, JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
console.log(`Share link created only for the validation alias; private response: ${resultFile}`);
console.log("Production/project-wide protection unchanged. Secret response not logged.");
