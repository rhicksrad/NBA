#!/usr/bin/env node
// Static integrity check for everything under public/.
// Fails CI when a page references a local file that does not exist,
// when a JSON snapshot does not parse, or when a page blows its weight budget.
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
const BUDGETS = { '.html': 120_000, '.css': 260_000, '.js': 400_000 };
const VENDOR = /[\\/]vendor[\\/]/;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const exists = async (path) => stat(path).then((s) => s.isFile(), () => false);
const isExternal = (ref) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);
const clean = (ref) => ref.split('#')[0].split('?')[0];

const problems = [];
const files = await walk(ROOT);
const rel = (file) => relative(ROOT, file);

for (const file of files) {
  const ext = extname(file);
  const size = (await stat(file)).size;
  if (BUDGETS[ext] && !VENDOR.test(file) && size > BUDGETS[ext]) {
    problems.push(`${rel(file)}: ${size} bytes is over the ${BUDGETS[ext]} byte budget for ${ext}`);
  }

  if (ext === '.json') {
    try {
      JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      problems.push(`${rel(file)}: invalid JSON (${error.message})`);
    }
    continue;
  }

  if (ext === '.html') {
    const html = await readFile(file, 'utf8');
    if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel(file)}: missing <title>`);
    if (!/<meta name="viewport"/.test(html)) problems.push(`${rel(file)}: missing viewport meta`);
    const refs = [...html.matchAll(/\s(?:href|src|poster)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (isExternal(ref) || ref.includes('${')) continue;
      const target = clean(ref);
      if (!target) continue;
      // Pages ship with <base href="/NBA/">, so every relative URL resolves from public/.
      const local = (target.startsWith('/NBA/') ? target.slice(5) : target.replace(/^\//, '')) || 'index.html';
      if (!(await exists(join(ROOT, local)))) problems.push(`${rel(file)}: broken reference "${ref}"`);
    }
    continue;
  }

  if (ext === '.css') {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ref = match[1];
      if (isExternal(ref) || ref.startsWith('data:')) continue;
      if (!(await exists(resolve(dirname(file), clean(ref))))) {
        problems.push(`${rel(file)}: broken url(${ref})`);
      }
    }
    continue;
  }

  if (ext === '.js' && !VENDOR.test(file)) {
    const js = await readFile(file, 'utf8');
    for (const match of js.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      if (!(await exists(resolve(dirname(file), clean(match[1]))))) {
        problems.push(`${rel(file)}: broken import "${match[1]}"`);
      }
    }
  }
}

if (problems.length) {
  console.error(`check-site: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`check-site: ${files.length} files OK`);
