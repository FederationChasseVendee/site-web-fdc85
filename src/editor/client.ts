import { errorMessage } from "./contracts";

const connectionStatus = document.querySelector<HTMLElement>("#connection-status");
const login = document.querySelector<HTMLAnchorElement>("#login");

async function initialize() {
  try {
    const response = await fetch("/api/editor/status", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("La passerelle GitHub n'est pas disponible. Configurez les Functions Cloudflare pour activer la connexion.");
    const status: unknown = await response.json();
    if (typeof status !== "object" || status === null || !("configured" in status)) throw new Error("Réponse de connexion invalide.");
    if (status.configured === true && login) {
      login.removeAttribute("aria-disabled");
      if (connectionStatus) connectionStatus.textContent = "Connectez-vous pour retrouver vos modifications.";
    } else if (connectionStatus) {
      connectionStatus.textContent = "La connexion GitHub n'est pas encore configurée sur cet environnement.";
    }
  } catch (error) {
    if (connectionStatus) connectionStatus.textContent = errorMessage(error);
  }
}

void initialize();
