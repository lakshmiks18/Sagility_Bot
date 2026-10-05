const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { submitCandidate } = require('./lib/registration-flow');
const { loadCandidates } = require('./testdata/candidates-xlsx');

const RESULTS_PATH = path.join(__dirname, 'results', 'run-log.json');

const HEADLESS = process.env.HEADLESS === '1';
const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL || 'msedge'; // 'msedge' | 'chrome' | '' for bundled chromium
const SLOWMO = Number(process.env.SLOWMO || 150);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { count: null, start: 0 };
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'count') opts.count = Number(value);
    if (key === 'start') opts.start = Number(value);
  }
  return opts;
}

async function runOne(context, record, index) {
  const page = await context.newPage();
  const log = { index, email: record.email, steps: [], status: 'FAILED', error: null };

  // Surface browser-side errors (e.g. getUserMedia/camera failures) in the
  // run output - these would otherwise be invisible since Playwright doesn't
  // propagate in-page console/JS errors into the Node process by default.
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[${index}] page console error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[${index}] page error: ${err.message}`));

  try {
    log.steps = await submitCandidate(page, record);
    log.status = 'SUBMITTED';
  } catch (err) {
    log.error = err.message;
    const screenshotPath = path.join(__dirname, 'results', `error-${index}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    log.screenshot = screenshotPath;
  } finally {
    await page.close();
  }

  return log;
}

async function main() {
  const { count, start } = parseArgs();
  const allRecords = await loadCandidates();
  const records = allRecords.slice(start, count ? start + count : undefined);

  console.log(`Running ${records.length} record(s) (start=${start}${count ? `, count=${count}` : ''})`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    channel: BROWSER_CHANNEL || undefined,
    slowMo: SLOWMO,
    // The Candidate Photo Capture step needs a real camera feed of whoever
    // is running this - '--use-fake-device-for-media-stream' was swapped out
    // because it feeds the app a synthetic green test pattern instead of a
    // real face, which the app's photo validation silently rejects (Submit
    // never advances past the capture screen). '--use-fake-ui-for-media-stream'
    // stays so the OS/browser camera permission prompt is still auto-accepted.
    args: ['--start-maximized', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: null, permissions: ['camera'] });

  const results = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const globalIndex = start + i;
    console.log(`\n[${globalIndex}] Submitting ${record.email} ...`);
    const log = await runOne(context, record, globalIndex);
    console.log(`[${globalIndex}] -> ${log.status}${log.error ? ` (${log.error})` : ''}`);
    results.push(log);
  }

  await context.close();
  await browser.close();

  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

  const succeeded = results.filter((r) => r.status === 'SUBMITTED').length;
  console.log(`\nDone. ${succeeded}/${results.length} submitted. Full log: ${RESULTS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
