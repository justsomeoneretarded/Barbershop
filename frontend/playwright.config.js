import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "retain-on-failure",
  },
  workers: 1,
  reporter: "list",
});
