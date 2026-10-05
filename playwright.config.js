const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // The full registration + screening flow has ~40+ field/button steps, each
  // with a deliberate 3-5s pause so the run is easy to watch live - that adds
  // up past 180s well before reaching the end, so the whole test needs a much
  // longer budget (confirmed live: timed out waiting on a button that was
  // actually present on screen, just because the test clock ran out first).
  //
  // The workday flow's runWorkdayStatusStage now loops through every
  // applicable status in one run (Screening Feedback Form through Employee
  // ID capture) instead of stopping after one stage - confirmed live: the
  // old 900000ms (15min) budget wasn't enough, it got killed mid-Assess
  // well before reaching DocuSign (which alone has a 15s wait + two
  // refreshes + a 30s wait) or Compensation's many 5s settle pauses.
  timeout: 3600000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Global safety net: without this, a locator action with no explicit
    // per-call timeout (e.g. .innerText() on a status regex that's missing
    // one real status label) doesn't fail fast - it silently retries for
    // up to the whole 3,600,000ms test timeout above instead of throwing
    // into its .catch(). Confirmed live: this is exactly what made a run
    // sit on the same screen for minutes with no error at all. 20s is
    // generous for any element that's actually going to show up.
    actionTimeout: 20000,
    headless: process.env.HEADLESS === '1',
    channel: process.env.BROWSER_CHANNEL || 'msedge',
    // Back to a normal maximized window, not a hardcoded large viewport -
    // the "Submit outside viewport" issue turned out to be an off-screen
    // duplicate element (see clickButtonByText), not a window-size problem,
    // and forcing 1920x1080 made the window take over the whole screen.
    viewport: null,
    permissions: ['camera'],
    // The Candidate Photo Capture step needs a real camera feed of whoever
    // is running this - '--use-fake-device-for-media-stream' was swapped out
    // because it feeds the app a synthetic green test pattern instead of a
    // real face, which the app's photo validation silently rejects (Submit
    // never advances past the capture screen). '--use-fake-ui-for-media-stream'
    // stays so the OS/browser camera permission prompt is still auto-accepted.
    launchOptions: {
      args: [
        '--start-maximized',
        '--use-fake-ui-for-media-stream',
      ],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
