export const REPOSITORY = "FederationChasseVendee/site-web-fdc85";
export const PRODUCTION_BRANCH = "main";
export const PRODUCTION_URL = "https://fdc85.maury.app";

/** @param {string} base */
export function normalizeBase(base) {
  return `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/\/{2,}/g, "/");
}

/** @param {string} base @param {string} route */
export function sitePath(base, route) {
  return `${normalizeBase(base)}${route.replace(/^\/+/, "")}`;
}

/**
 * Pages CMS expects the full repository-relative file path encoded as ONE segment.
 * @param {string} branch
 * @param {{name: string, type: string}} collection
 * @param {string} [file]
 */
export function cmsUrl(branch, collection, file) {
  const root = `https://app.pagescms.org/${REPOSITORY}/${encodeURIComponent(branch)}`;
  const name = encodeURIComponent(collection.name);
  return collection.type === "file"
    ? `${root}/file/${name}`
    : `${root}/collection/${name}${file ? `/edit/${encodeURIComponent(file.replace(/\\/g, "/"))}` : ""}`;
}

/**
 * Match the actual filtering rules in IndexPage, including the unfiltered FAQ.
 * @param {{source: string, category?: string}} index
 * @param {string} collection
 * @param {{category?: string}} data
 */
export function indexContains(index, collection, data) {
  if (index.source !== collection) return false;
  if (!index.category || ["faqs", "glossary", "trainings"].includes(collection)) return true;
  if (collection === "directories") {
    return (data.category ?? "").toLocaleLowerCase("fr").includes(index.category.toLocaleLowerCase("fr"));
  }
  return data.category === index.category;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
export function deploymentUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    // Only immutable deployments from this project; never a guessed branch alias.
    return url.protocol === "https:" && /^[a-f0-9]{8}\.fdc85\.pages\.dev$/.test(url.hostname)
      && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

/** @param {unknown} value @param {string} sha */
export function cloudflareCheck(value, sha) {
  if (!isRecord(value) || !Array.isArray(value.check_runs)) {
    throw new Error("La réponse des déploiements est invalide.");
  }
  const check = value.check_runs.find((item) => isRecord(item)
    && item.name === "Cloudflare Pages" && item.head_sha === sha);
  if (!isRecord(check)) return { state: "missing", url: null };
  if (check.status !== "completed") return { state: "pending", url: null };
  if (check.conclusion !== "success") return { state: "failed", url: null };
  const summary = isRecord(check.output) && typeof check.output.summary === "string" ? check.output.summary : "";
  const candidates = summary.match(/https:\/\/[a-f0-9]{8}\.fdc85\.pages\.dev\b/g) ?? [];
  const url = candidates.map(deploymentUrl).find(Boolean) ?? null;
  return { state: url ? "ready" : "unlocated", url };
}

/** @param {unknown} value */
export function parseIdentity(value) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.build)) {
    throw new Error("Cette version ne fournit pas encore les informations de prévisualisation.");
  }
  const build = value.build;
  if (typeof build.branch !== "string" || typeof build.commit !== "string"
    || typeof build.builtAt !== "string" || !["production", "preview", "local"].includes(String(build.environment))
    || typeof value.base !== "string" || typeof value.productionUrl !== "string"
    || (build.commit !== "" && !/^[0-9a-f]{40}$/i.test(build.commit))) {
    throw new Error("Les informations de version sont invalides.");
  }
  return {
    branch: build.branch,
    commit: build.commit,
    builtAt: build.builtAt,
    environment: String(build.environment),
    base: normalizeBase(value.base),
  };
}

/** @param {{commit: string, environment: string}} current @param {{commit: string} | null} production */
export function comparisonState(current, production) {
  if (current.environment === "local") return "unknown";
  if (!current.commit || !production?.commit) return "unknown";
  if (current.commit === production.commit) return "same";
  return current.environment === "preview" ? "different" : "unknown";
}

/** @param {string} built @param {string} latest */
export function freshnessState(built, latest) {
  if (!built || !latest) return "unknown";
  return built === latest ? "current" : "stale";
}
