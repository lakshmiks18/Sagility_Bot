const path = require('path');
const { chromium } = require('playwright');
const { completeScreeningFlow } = require('./lib/registration-flow');
const { loadCandidates } = require('./testdata/candidates-xlsx');

const DASHBOARD_URL = 'https://uatapps.sagilityhealth.com/SagiHire-Ignite/Dashboard/StartChat';

const HEADLESS = process.env.HEADLESS === '1';
const BROWSER_CHANNEL = process.env.BROWSER_CHANNEL || 'msedge';
const SLOWMO = Number(process.env.SLOWMO || 150);
const RECORD_INDEX = Number(process.env.RECORD_INDEX || 0);

async function main() {
  const records = await loadCandidates();
  const record = records[RECORD_INDEX];
  console.log(`Running screening-only flow for [${RECORD_INDEX}] ${record.email}`);

  const browser = await chromium.launch({
    headless: HEADLESS,
    channel: BROWSER_CHANNEL || undefined,
    slowMo: SLOWMO,
    // Real camera feed (not a synthetic test pattern) - see register.js for why.
    args: ['--start-maximized', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: null, permissions: ['camera'] });
  const page = await context.newPage();

  try {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const steps = await completeScreeningFlow(page, record);
    console.log('Steps completed:', steps);
  } catch (err) {
    console.error('Failed:', err.message);
    await page.screenshot({ path: path.join(__dirname, 'results', `screening-only-error-${Date.now()}.png`), fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
