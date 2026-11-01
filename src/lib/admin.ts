export const REPOSITORY = "FederationChasseVendee/site-web-fdc85";
export const PRODUCTION_ORIGIN = "https://fdc85.maury.app";
export const CMS_ORIGIN = "https://app.pagescms.org";

export interface AdminContent {
  id: string;
  label: string;
  collection: string;
  kind: "file" | "collection" | "entry" | "media";
  path?: string;
  routes: string[];
  impact: string;
}

export interface AdminRoute {
  path: string;
  label: string;
  contentId: string;
}

export interface AdminManifest {
  repository: string;
  branch: string;
  commit: string;
  buildTime: string;
  deployment: string | null;
  base: string;
  source: "cloudflare" | "git";
  contents: AdminContent[];
  routes: AdminRoute[];
}

export function normalizeBase(base: string): string {
  return `/${base.replace(/^\/+|\/+$/g, "")}/`.replace(/\/+/g, "/");
}

export function safeRoute(route: string): string {
  const decoded = decodeURIComponent(route).replace(/\\/g, "/");
  const segments = decoded.replace(/^\/+|\/+$/g, "").split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment.toLowerCase() === "admin")
    || /[?#:]/.test(decoded)) {
    throw new Error("Cette adresse ne peut pas être affichée dans la prévisualisation.");
  }
  return segments.filter(Boolean).map(encodeURIComponent).join("/") + (segments.some(Boolean) ? "/" : "");
}

export function previewUrl(origin: string, base: string, route: string): string {
  const url = new URL(`${normalizeBase(base)}${safeRoute(route)}`, origin);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Origine de prévisualisation invalide.");
  url.searchParams.set("admin-preview", "1");
  return url.href;
}

export function cmsUrl(branch: string, content?: Pick<AdminContent, "kind" | "collection" | "path">): string {
  if (!branch.trim()) throw new Error("La branche de travail est requise.");
  const root = `${CMS_ORIGIN}/${REPOSITORY}/${encodeURIComponent(branch)}`;
  if (!content) return root;
  const name = encodeURIComponent(content.collection);
  if (content.kind === "file") return `${root}/file/${name}`;
  if (content.kind === "media") return `${root}/media/${name}`;
  if (content.kind === "collection") return `${root}/collection/${name}`;
  if (!content.path || content.path.replace(/\\/g, "/").split("/").some((part) => part === ".." || part === ".")) {
    throw new Error("Le chemin du contenu Pages CMS est invalide.");
  }
  return `${root}/collection/${name}/edit/${encodeURIComponent(content.path.replace(/\\/g, "/"))}`;
}

export type CmsFrameState = "loading" | "unverified" | "timeout" | "error";

export function cmsFrameMessage(state: CmsFrameState): string {
  const messages: Record<CmsFrameState, string> = {
    loading: "Ouverture de Pages CMS… La connexion et l’accès au dépôt restent à vérifier dans le cadre.",
    unverified: "Le cadre a émis un événement de chargement. Cela ne confirme ni la connexion, ni l’ouverture de l’éditeur.",
    timeout: "Le délai d’attente est écoulé. Si le cadre reste vide ou bloqué, ouvrez le CMS dans un nouvel onglet.",
    error: "Le navigateur a signalé une erreur du cadre. Ouvrez le CMS dans un nouvel onglet pour consulter son message.",
  };
  return messages[state];
}

export function deploymentFromCheck(summary: string): string {
  const matches = summary.match(/https:\/\/[a-f0-9]{8}\.fdc85\.pages\.dev/g);
  if (!matches?.length) throw new Error("Le contrôle Cloudflare ne fournit pas d’URL de déploiement immuable reconnue.");
  return new URL(matches[0]).origin;
}

export function validateDeployment(manifest: AdminManifest, branch: string, commit: string): void {
  if (manifest.repository !== REPOSITORY || manifest.branch !== branch || manifest.commit !== commit) {
    throw new Error("Le déploiement ne correspond pas à la branche et au commit demandés.");
  }
  if (!Array.isArray(manifest.routes) || normalizeBase(manifest.base) !== "/") {
    throw new Error("Le manifeste du déploiement est incompatible avec cette prévisualisation Cloudflare.");
  }
}
