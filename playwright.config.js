const { defineConfig } = require('@playwright/test');

// Remote checks use isolated fixture contexts and block sync/AI Worker requests.
const remoteAppURL = process.env.MEMORY_APP_TEST_URL;
// Managed environments can use an installed Chromium when downloads are restricted.
const chromiumExecutable = process.env.MEMORY_APP_CHROMIUM_EXECUTABLE_PATH;

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: remoteAppURL || 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : {},
    headless: true,
    serviceWorkers: 'block'
  },
  webServer: remoteAppURL ? undefined : {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  }
});
