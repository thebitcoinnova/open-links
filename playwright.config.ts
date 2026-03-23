import { defineConfig, devices } from "@playwright/test";

const host = "127.0.0.1";
const port = 4173;
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    headless: true,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 2200 },
  },
  webServer: {
    command: `bunx vite build && bunx vite preview --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 2200 },
      },
    },
  ],
});
