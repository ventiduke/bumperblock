// Cache-busting for GitHub Pages (no build step): stamps every script and
// stylesheet with a short hash of its contents. Module imports inside the
// game stay plain ('./ai.js'); an import map in index.html points each one at
// its stamped URL, so a file is only re-downloaded when it actually changed.
//
// Run before committing:  node tools/stamp.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (rel) => createHash('sha1').update(readFileSync(join(root, rel))).digest('hex').slice(0, 8);
const stamped = (rel) => `${rel}?v=${hash(rel)}`;

const modules = ['config.js', ...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).sort().map((f) => `js/${f}`)];
const imports = Object.fromEntries(modules.map((m) => [`./${m}`, `./${stamped(m)}`]));
const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2).replace(/^/gm, '  ')}\n  </script>`;

const file = join(root, 'index.html');
let html = readFileSync(file, 'utf8');
const swap = (re, text) => {
  if (!re.test(html)) throw new Error(`stamp: pattern not found: ${re}`);
  html = html.replace(re, text);
};
swap(/<link rel="stylesheet" href="style\.css[^"]*">/, `<link rel="stylesheet" href="${stamped('style.css')}">`);
swap(/<script src="lib\/planck\.min\.js[^"]*"><\/script>/, `<script src="${stamped('lib/planck.min.js')}"></script>`);
// The import map must come before the first module script.
html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
swap(/(\s*)<script type="module" src="js\/main\.js[^"]*"><\/script>/,
  `$1${map}$1<script type="module" src="${stamped('js/main.js')}"></script>`);
writeFileSync(file, html);
console.log(`stamped ${modules.length} modules, style.css, planck`);
