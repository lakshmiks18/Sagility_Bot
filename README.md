# SagiHire Registration Automation

Playwright automation for `https://uatapps.sagilityhealth.com/SagihireUS/SagiHireRegistration`.

## Setup (already done in this folder)

This machine is behind a Zscaler TLS-inspecting proxy, which breaks Node/npm's
certificate validation by default. `certs/zscaler-root.pem` is the exported
Zscaler root CA. If you ever need to reinstall dependencies or Playwright
browsers, set this first:

```bash
export NODE_EXTRA_CA_CERTS="$(pwd)/certs/zscaler-root.pem"
npm install
npx playwright install chromium
```

## Known blocker: "Unauthorized" for automated sessions

The registration page returns an app-level "Unauthorized" redirect for **any**
Playwright-driven browser (tested: fresh profile, real cookies copied in,
headless, headed, real `msedge.exe` binary via `channel: 'msedge'`, with the
`navigator.webdriver` automation flag hidden). It works instantly in a
normal, manually-used Edge window. This points to a deliberate anti-bot /
anti-automation control on the candidate-facing registration form, not a
config or cookie problem.

Before running this for real, get this use case allow-listed with whoever
owns the UAT environment (IT/QA/security) — e.g. a feature flag disabling
bot-detection on UAT, an allow-listed test route, or a documented API
alternative to the browser form.

## Files

- `testdata/generate-testdata.js` — generates `testdata/candidates.json`
  (50 records; record 0 always uses `aerald.sapienza@allfreemail.net`).
- `testdata/candidates.json` — the generated test data.
- `resume/dummy-resume.pdf` — placeholder resume uploaded for every record.
- `lib/registration-flow.js` — shared automation logic (fills the modal and
  form, uploads the resume, submits) used by both entry points below.
- `tests/register.spec.js` + `playwright.config.js` — standard
  `@playwright/test` spec, one test per candidate record. Run with
  `npx playwright test` and get an HTML report (`playwright-report/`).
- `register.js` — plain Node script alternative (no test runner/report),
  useful for a quick console-only run.
- `results/run-log.json` — written by `register.js` only: per-record status
  (`SUBMITTED` / `FAILED`), steps completed, and any error + screenshot.

## Running

Two equivalent ways to run this — pick one:

**Playwright Test runner (recommended — gives pass/fail + HTML report):**

```bash
npm run test:one   # submit only record 0 - use this first to validate selectors
npm run test:all   # submit all 50 records
npx playwright show-report   # view the HTML report after a run
```

Env vars `TEST_START` / `TEST_COUNT` control the slice of `candidates.json`
used (see `tests/register.spec.js`).

**Plain script:**

```bash
npm run generate-data   # regenerate testdata/candidates.json if you tweak the generator
npm run register:one    # submit only the first record (index 0)
npm run register:all    # submit all 50 records
```

Example: `node register.js --count=1 --start=0` runs just record 0;
`--start=10 --count=5` runs records 10-14.

Useful env vars (both entry points):

- `HEADLESS=1` — run headless (default is headed, since this app has shown
  different behavior for automated sessions and headed is more likely to
  match a real user).
- `BROWSER_CHANNEL=chrome` — use installed Chrome instead of Edge (default
  `msedge`). Set to empty string to use Playwright's bundled Chromium.
- `SLOWMO=300` (plain script only) — milliseconds of delay between actions,
  handy while debugging selectors.

## Assumptions to verify on first real run

The screenshots this was built from didn't show the whole form. These are
best-effort and logged as warnings (not hard failures) if they don't match:

- City field placeholder: `Enter City`
- Address "State" dropdown label: `State` (distinct from the "state would
  like to apply in" dropdown, which is confirmed and set to "El Paso")
- Postal code field placeholder: `Enter Postal Code`
- One more Yes/No question appears after the salary field per your
  description — the script currently assumes it's the last radio pair on
  the page and answers "No". Confirm the actual question text and fix the
  `answerYesNo(...)` call in `register.js` if this guess is wrong.

If any selector doesn't match on your first `register:one` run, check
`results/run-log.json` for the failed step and `results/error-*.png` for a
screenshot at the point of failure, then adjust the corresponding
`getByPlaceholder` / `selectByLabel` / `answerYesNo` call in `register.js`.
