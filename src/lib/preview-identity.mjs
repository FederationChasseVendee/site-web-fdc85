import { execFileSync } from "node:child_process";
import { PRODUCTION_BRANCH, deploymentUrl } from "./preview.mjs";

/**
 * @param {Record<string, string | undefined>} env
 * @param {{branch: string, commit: string}} local
 */
export function createIdentity(env, local) {
  const hosted = env.CF_PAGES === "1";
  const branch = hosted ? env.CF_PAGES_BRANCH ?? "" : local.branch;
  const commit = hosted ? env.CF_PAGES_COMMIT_SHA ?? "" : local.commit;
  if (commit && !/^[0-9a-f]{40}$/i.test(commit)) throw new Error("Identifiant de version invalide.");
  return {
    branch,
    commit,
    builtAt: new Date().toISOString(),
    environment: hosted ? (branch === PRODUCTION_BRANCH ? "production" : "preview") : "local",
    preview: env.PREVIEW_BUILD === "true" || (hosted && branch !== PRODUCTION_BRANCH),
    deploymentUrl: hosted ? deploymentUrl(env.CF_PAGES_URL) : null,
  };
}

function localIdentity() {
  if (process.env.CF_PAGES === "1") return { branch: "", commit: "" };
  return {
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  };
}

export const buildIdentity = createIdentity(process.env, localIdentity());
