// Shared setup for the browser behavior tests.
//   BB_URL             base URL of the served game (default http://localhost:8080/)
//   PLAYWRIGHT_MODULE  path to a Playwright install, if `playwright` isn't resolvable
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import('playwright').catch(() => {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  throw new Error('Playwright not found: run `npm i -D playwright` (or set PLAYWRIGHT_MODULE)');
});
export const { chromium } = pw;

export const URL = (process.env.BB_URL || 'http://localhost:8080/').replace(/\/?$/, '/');
export const out = join(dirname(fileURLToPath(import.meta.url)), 'out'); // screenshots
mkdirSync(out, { recursive: true });

// Print a PASS/FAIL line; any FAIL makes the process exit non-zero.
export function ok(cond, msg) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}
