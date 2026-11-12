#!/usr/bin/env node
// Browser smoke test. Loads every page in real Chromium with all third-party
// hosts blocked (the site must stand on its snapshots alone), then loads the
// home page again against a recorded ESPN scoreboard to prove the live path.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}/`;
const PAGES = [
  'index.html', 'games.html', 'players.html', 'teams.html', 'goat.html', 'history.html',
  'insights.html', 'rewind.html', 'about.html', '404.html',
  'game-tracker.html?gameId=401909976', 'game-preview.html?gameId=401909976',
];
const VIEWPORTS = [{ width: 1366, height: 900 }, { width: 390, height: 844 }];

const server = spawn(process.execPath, [fileURLToPath(new URL('../dev/serve-public.js', import.meta.url)), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', (code) => reject(new Error(`static server exited with ${code}`)));
});

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const failures = [];
const fail = (page, message) => failures.push(`${page}: ${message}`);

async function visit(path, viewport, { scoreboard } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const label = `${path} @${viewport.width}`;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    if (scoreboard && route.request().url().includes('/scoreboard')) {
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: scoreboard });
    }
    return route.abort('internetdisconnected');
  });
  page.on('pageerror', (error) => fail(label, `uncaught ${error.message}`));
  page.on('console', (message) => {
    // Being offline is the scenario under test; a page logging that it could not reach a feed is fine.
    if (message.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to fetch|Unable to load|Failed to load/i.test(message.text())) {
      fail(label, `console error: ${message.text().slice(0, 200)}`);
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith(BASE) && response.status() >= 400) fail(label, `${response.status()} ${response.url().slice(BASE.length)}`);
  });

  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  if ((await page.locator('header.table nav a').count()) < 9) fail(label, 'site navigation missing');
  if (!(await page.locator('h1').first().isVisible())) fail(label, 'no visible h1');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) fail(label, `page scrolls sideways by ${overflow}px`);
  const fonts = await page.evaluate(() => document.fonts.check('16px "Big Shoulders"') && document.fonts.check('16px Archivo'));
  if (!fonts) fail(label, 'web fonts did not load');
  return { page, context, label };
}

try {
  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      const { context } = await visit(path, viewport);
      await context.close();
    }
  }

  // Offline home page: tables must paint from the committed snapshot.
  {
    const { page, context, label } = await visit('index.html', VIEWPORTS[0]);
    if ((await page.locator('.standings__table tbody tr').count()) !== 30) fail(label, 'standings did not render 30 teams from the snapshot');
    if ((await page.locator('.leaders__board').count()) < 1) fail(label, 'leaders did not render from the snapshot');
    await context.close();
  }

  // Live path: a recorded ESPN scoreboard must turn into game tiles.
  {
    const scoreboard = await readFile(new URL('../testdata/espn/scoreboard.json', import.meta.url), 'utf8');
    const { page, context, label } = await visit('index.html', VIEWPORTS[0], { scoreboard });
    await page.waitForSelector('.tile', { timeout: 5000 }).catch(() => {});
    const tiles = await page.locator('.tile').count();
    if (tiles !== 2) fail(label, `expected 2 live tiles from the recorded scoreboard, saw ${tiles}`);
    const text = (await page.locator('.board__games').innerText()).replace(/\s+/g, ' ');
    if (!/PHI/.test(text) || !/TOR/.test(text)) fail(label, `scoreboard tiles missing teams: ${text.slice(0, 120)}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`smoke: ${failures.length} failure(s)\n` + [...new Set(failures)].map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`smoke: ${PAGES.length} pages × ${VIEWPORTS.length} viewports OK, snapshot and live paths OK`);
