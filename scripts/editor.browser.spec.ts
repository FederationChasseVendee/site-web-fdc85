import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseSource } from "../src/lib/editor/model";

test.beforeEach(async ({ page }) => {
  await page.goto("");
  await expect(page.locator("#content-select")).toBeVisible();
  await expect(page.frameLocator("iframe").locator("h1")).toBeVisible();
});

test("unsaved home changes use real rendering, responsive widths and no analytics", async ({ page }) => {
  const tracking: string[] = [];
  page.on("request", (request) => { if (request.url().includes("umami")) tracking.push(request.url()); });
  await page.getByLabel("Titre principal", { exact: false }).fill("Accueil modifié sans publication");
  await expect(page.frameLocator("iframe").locator("h1")).toHaveText("Accueil modifié sans publication");
  await expect(page.getByRole("button", { name: "Publication indisponible ici" })).toBeDisabled();
  await expect(page.getByText("Modifications non enregistrées dans GitHub", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mobile 390 px" }).click();
  await expect(page.locator("iframe")).toHaveCSS("width", "390px");
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".home-hero img")).toBeVisible();
  expect(await frame.locator(".home-hero img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(frame.locator("a[href],script")).toHaveCount(0);
  expect(tracking).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("editeur-mobile.png"), fullPage: false });
});

test("Markdown draft, export round-trip, cancellation and reset", async ({ page }) => {
  await page.locator("#content-select").selectOption("src/content/standard-pages/contact.md");
  await page.locator("#field-body").fill("## Nouveau contenu\n\n**Texte fort** et [Contacter](mailto:fdc85@chasse85.fr).");
  await expect(page.frameLocator("iframe").locator(".prose h2")).toHaveText("Nouveau contenu");
  await expect(page.frameLocator("iframe").locator(".prose strong")).toHaveText("Texte fort");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter le Markdown" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("contact.md");
  const source = readFileSync((await download.path())!, "utf8");
  expect(parseSource(source, "yaml-frontmatter").body).toContain("Nouveau contenu");
  await expect(page.getByText("Modifications non enregistrées dans GitHub", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#content-select").selectOption("src/content/home.json");
  await expect(page.locator("#content-select")).toHaveValue("src/content/standard-pages/contact.md");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Abandonner les modifications" }).click();
  await expect(page.locator("#field-body")).toHaveValue(/Nouveau contenu/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Abandonner les modifications" }).click();
  await expect(page.locator("#field-body")).not.toHaveValue(/Nouveau contenu/);
  await expect(page.getByRole("button", { name: "Abandonner les modifications" })).toBeDisabled();
  await expect(page.frameLocator("iframe").locator(".prose h2").first()).toHaveText("Coordonnées");
});

test("draft recovery persists immediate navigation, with no silent overwrite", async ({ page }) => {
  const originalTitle = await page.getByLabel("Titre principal", { exact: false }).inputValue();
  await page.getByLabel("Titre principal", { exact: false }).fill("Brouillon à reprendre");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#content-select").selectOption("src/content/standard-pages/contact.md");
  await page.locator("#content-select").selectOption("src/content/home.json");
  await expect(page.getByRole("button", { name: "Reprendre le brouillon" })).toBeVisible();
  await expect(page.getByLabel("Titre principal", { exact: false })).toHaveValue(originalTitle);
  await page.getByRole("button", { name: "Reprendre le brouillon" }).click();
  await expect(page.frameLocator("iframe").locator("h1")).toHaveText("Brouillon à reprendre");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "Reprendre le brouillon" }).click();
  await expect(page.getByLabel("Titre principal", { exact: false })).toHaveValue("Brouillon à reprendre");
});

test("invalid fields stop preview/export and safe text cannot execute", async ({ page }) => {
  await page.getByLabel("Titre principal", { exact: false }).fill("");
  await expect(page.getByRole("button", { name: "Exporter le JSON" })).toBeDisabled();
  await expect(page.getByText("Titre principal : champ obligatoire.", { exact: false })).toBeVisible();
  await expect(page.frameLocator("iframe").locator("h1")).toHaveText("Aperçu indisponible");
  await page.getByLabel("Titre principal", { exact: false }).fill("<img src=x onerror=alert(1)>");
  await expect(page.frameLocator("iframe").locator("h1")).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.frameLocator("iframe").locator("h1 img")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("resource changes appear in an actual index and CMS transfer limitation is explicit", async ({ page }) => {
  const option = page.locator('#content-select option[value^="src/content/faqs/"]').first();
  const path = await option.getAttribute("value");
  await page.locator("#content-select").selectOption(path!);
  await page.locator("#field-question").fill("Question de test locale");
  await expect(page.frameLocator("iframe").locator(".index-item h2").filter({ hasText: "Question de test locale" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Ouvrir ce contenu dans Pages CMS/ })).toHaveAttribute("href", /\/collection\/faqs\/edit\/src%2Fcontent%2Ffaqs/);
  await expect(page.getByText(/Ouvrir Pages CMS ne lui transfère pas votre brouillon/)).toBeVisible();
});

test("schema-driven nested objects/lists and optional article blocks", async ({ page }) => {
  const path = await page.locator('#content-select option[value^="src/content/articles/"]').first().getAttribute("value");
  await page.locator("#content-select").selectOption(path!);
  await page.locator("#field-title").fill("Article de travail");
  await expect(page.frameLocator("iframe").locator("h1")).toHaveText("Article de travail");
  await page.locator("#field-archived").check();
  await expect(page.frameLocator("iframe").locator(".status-message")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter : Documents associés" }).click();
  await page.locator("#field-documents-0-label").fill("Document local");
  await page.locator("#field-documents-0-url").fill("https://example.org/document.pdf");
  await expect(page.frameLocator("iframe").locator(".resource-block")).toContainText("Document local");
  await page.getByRole("button", { name: "Supprimer l’élément 1", exact: true }).click();
  await expect(page.frameLocator("iframe").locator(".resource-block")).toHaveCount(0);
});

test("blocked local storage reports memory-only state and still allows cancel/reset", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Stockage refusé", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Stockage refusé", "SecurityError"); };
    Storage.prototype.removeItem = () => { throw new DOMException("Stockage refusé", "SecurityError"); };
  });
  await page.reload();
  const title = page.getByLabel("Titre principal", { exact: false });
  const original = await title.inputValue();
  await title.fill("Mémoire uniquement");
  await expect(page.getByText(/Impossible de lire le brouillon local/)).toBeVisible();
  await expect(page.frameLocator("iframe").locator("h1")).toHaveText("Mémoire uniquement");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Abandonner les modifications" }).click();
  await expect(title).toHaveValue(original);
  await expect(page.getByText(/Contenu rétabli, mais impossible de supprimer le stockage local/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Abandonner les modifications" })).toBeDisabled();
});
