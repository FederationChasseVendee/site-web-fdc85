import assert from "node:assert/strict";
import { chromium } from "playwright";
import { unzipSync, strFromU8 } from "fflate";
import { readFile, writeFile } from "node:fs/promises";

const url = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:4357/admin/";
const shared = process.env.ADMIN_TEST_CDP;
const browser = shared ? await chromium.connectOverCDP(shared) : await chromium.launch({ headless: true });
const context = shared ? browser.contexts()[0] : await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const vendorRequests = [];
const consoleMessages = [];
let stopping = false;
let failure;
page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") consoleMessages.push(message.text()); });
page.on("requestfailed", (request) => consoleMessages.push(`${request.url()} : ${request.failure()?.errorText}`));
page.on("pageerror", (error) => { if (!stopping) errors.push(error.message); });
page.on("request", (request) => {
  if (/stackblitz|webcontainer|staticblitz/.test(new URL(request.url()).hostname)) vendorRequests.push(request.url());
});
try {
  await page.goto(url);
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, "admin must be crossOriginIsolated");
  assert.equal(vendorRequests.length, 0, "runtime must be lazy before explicit start");
  await page.locator("#start").click();
  try {
    await page.waitForFunction(() => document.querySelector("#status-dot")?.getAttribute("data-state") === "ready"
      || document.querySelector("#status-dot")?.getAttribute("data-state") === "error", null, { timeout: 600_000 });
    assert.equal(await page.locator("#status-dot").getAttribute("data-state"), "ready",
      await page.locator("#message").innerText() + "\n" + await page.locator("#logs").textContent());
    const preview = page.frameLocator("#preview");
    await preview.locator("h1").waitFor({ timeout: 180_000 });
    const original = await preview.locator("h1").innerText();
    const home = JSON.parse(await page.locator("#source").inputValue());
    home.hero.title = `Brouillon navigateur : HMR réel ${Date.now()}`;
    const changed = JSON.stringify(home, null, 2) + "\n";
    await page.locator("#source").fill(changed);
    await page.locator("#apply").click();
    await preview.getByRole("heading", { level: 1, name: home.hero.title }).waitFor({ timeout: 120_000 });
    assert.notEqual(original, home.hero.title);
    assert.equal(await preview.locator('script[src*="umami"]').count(), 0);
    assert.equal(await preview.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
    if (new URL(url).protocol === "https:") {
      await preview.locator("img").first().evaluate((image) => new Promise((resolve, reject) => {
        if (image.complete) { image.naturalWidth ? resolve(true) : reject(new Error("Média public non chargé")); return; }
        image.addEventListener("load", () => resolve(true), { once: true });
        image.addEventListener("error", () => reject(new Error("Média public bloqué par COEP")), { once: true });
      }));
    }
    await page.locator("#collection").selectOption("standardPages");
    await page.locator("#file").selectOption("src/content/standard-pages/contact.md");
    await preview.getByRole("heading", { level: 1, name: /^Contact/ }).waitFor({ timeout: 120_000 });
    const pageTitle = `Contact — brouillon ${Date.now()}`;
    const pageDraft = (await page.locator("#source").inputValue()).replace(/^title:.*$/m, `title: ${JSON.stringify(pageTitle)}`)
      + "\n\n**Markdown réel du brouillon navigateur.**\n";
    await page.locator("#source").fill(pageDraft);
    await page.locator("#apply").click();
    await preview.getByRole("heading", { level: 1, name: pageTitle }).waitFor({ timeout: 120_000 });
    await preview.locator("strong").filter({ hasText: "Markdown réel du brouillon navigateur." }).first().waitFor();
    await page.locator("#mobile").click();
    assert.equal(await page.locator("#preview").evaluate((element) => element.getBoundingClientRect().width), 390);
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#export").click();
    const download = await downloadEvent;
    const zip = unzipSync(await readFile(await download.path()));
    assert.equal(strFromU8(zip["src/content/home.json"]), changed);
    assert.equal(strFromU8(zip["src/content/standard-pages/contact.md"]), pageDraft);
    assert.deepEqual(errors, [], "No browser exception before stopping the runtime");
    if (process.env.ADMIN_TEST_SCREENSHOT) await page.screenshot({ path: process.env.ADMIN_TEST_SCREENSHOT, fullPage: true });
    stopping = true;
    await page.locator("#stop").click();
    assert.equal(await page.locator("#preview").isVisible(), false);
    assert.match(await page.locator("#message").innerText(), /conservés/);
    assert.ok(vendorRequests.length);
    console.log(JSON.stringify({ url, nodeAndNpm: "executed in Chromium WebContainer", astro: "server-ready on port 4321",
      hmr: [home.hero.title, pageTitle], markdown: "original Astro Content rendered strong text",
      publicMedia: new URL(url).protocol === "https:" ? "loaded" : "HTTPS deployment test required (localhost images blocked)",
      exportedPaths: Object.keys(zip), lazy: true, isolated: true,
      noUmami: true, mobileWidth: 390, pageErrors: errors }, null, 2));
  } finally {
    if (process.env.ADMIN_TEST_LOG) await writeFile(process.env.ADMIN_TEST_LOG,
      await page.locator("#logs").textContent() + "\n\nBrowser console:\n" + consoleMessages.join("\n")
      + "\n\nVendor requests:\n" + vendorRequests.join("\n"));
    if (process.env.ADMIN_TEST_SCREENSHOT && !stopping) await page.screenshot({ path: process.env.ADMIN_TEST_SCREENSHOT, fullPage: true });
  }
} catch (error) {
  failure = error;
} finally {
  if (shared) {
    await page.close();
  } else {
    await context.close();
    await browser.close();
  }
}
if (failure) console.error(failure);
// Disconnect the test client's CDP socket by exiting only this Node process;
// never close the shared browser or its default context.
if (shared) process.exit(failure ? 1 : 0);
if (failure) throw failure;
