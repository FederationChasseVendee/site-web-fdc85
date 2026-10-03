import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const catalog = JSON.parse(readFileSync("dist/editeur/catalogue.json", "utf8"));
const remote = process.env.EDITOR_TEST_URL;
export default defineConfig({
  testDir: ".",
  testMatch: "editor.browser.spec.ts",
  outputDir: process.env.EDITOR_TEST_ARTIFACTS ?? resolve("node_modules/.cache/editor-playwright"),
  workers: 1,
  reporter: "list",
  use: {
    baseURL: remote ?? `http://127.0.0.1:4373${catalog.base}editeur/`,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: remote ? undefined : {
    command: "npm run preview -- --host 127.0.0.1 --port 4373",
    cwd: process.cwd(),
    env: { ASTRO_BASE_PATH: catalog.base, ASTRO_SITE: catalog.siteUrl },
    url: `http://127.0.0.1:4373${catalog.base}editeur/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
