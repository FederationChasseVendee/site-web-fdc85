export const UMAMI_CLOUD_SCRIPT_URL = "https://cloud.umami.is/script.js";

const WEBSITE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getUmamiConfig(analytics) {
  if (!analytics || typeof analytics.enabled !== "boolean") {
    throw new Error(
      "Configuration Analytics invalide : le champ « enabled » doit être un booléen.",
    );
  }

  if (!analytics.enabled) {
    return null;
  }

  const websiteId =
    typeof analytics.websiteId === "string" ? analytics.websiteId.trim() : "";

  if (!WEBSITE_ID_PATTERN.test(websiteId)) {
    throw new Error(
      "Configuration Analytics invalide : désactivez Umami ou renseignez un Website ID Umami valide dans src/content/site.json via /edit/.",
    );
  }

  return {
    scriptUrl: UMAMI_CLOUD_SCRIPT_URL,
    websiteId,
  };
}
