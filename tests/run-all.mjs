// Runs every *.test.mjs in this folder and prints a summary.
// Serve the repo root first (e.g. `npx http-server . -p 8080 -c-1`), then:
//   node tests/run-all.mjs            (BB_URL=... to point elsewhere)
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.test.mjs')).sort()) {
  const r = spawnSync(process.execPath, [join(dir, f)], { encoding: 'utf8', env: process.env });
  const lines = (r.stdout || '').split('\n');
  const p = lines.filter((l) => l.startsWith('PASS')).length;
  const failed = lines.filter((l) => l.startsWith('FAIL'));
  pass += p;
  fail += failed.length + (r.status && !failed.length ? 1 : 0);
  console.log(`${failed.length || r.status ? '✗' : '✓'} ${f}: ${p} passed${failed.length ? `, ${failed.length} failed` : ''}`);
  for (const l of failed) console.log('    ' + l);
  if (r.status && !failed.length) console.log('    crashed:\n' + (r.stderr || '').trim().split('\n').slice(-5).map((l) => '      ' + l).join('\n'));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
