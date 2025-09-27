// build.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';

const outDir = 'assets/js';
const tempOutFile = join(outDir, 'main.tmp.js');

await fs.mkdir(outDir, { recursive: true });

// 1) Bundle to a temporary file
await build({
  entryPoints: ['components/main.ts'],
  bundle: true,
  format: 'esm',
  target: ['es2019'],
  sourcemap: false,
  outfile: tempOutFile,
  minify: true,
});

// 2) Fingerprint the bundle
const fileBuffer = await fs.readFile(tempOutFile);
const hash = createHash('sha256').update(fileBuffer).digest('hex').slice(0, 8);
const finalName = `main.${hash}.js`;
const finalPath = join(outDir, finalName);

// 3) Clean old hashed bundles (keep the new one and temp)
const existingFiles = await fs.readdir(outDir);
await Promise.all(
  existingFiles
    .filter(
      (file) =>
        file.startsWith('main.') &&
        file.endsWith('.js') &&
        file !== finalName &&
        file !== 'main.tmp.js',
    )
    .map((file) => fs.unlink(join(outDir, file))),
);

// 4) Write final bundle and remove temp
await fs.writeFile(finalPath, fileBuffer);
await fs.unlink(tempOutFile);

// 5) Update HTML references to the new hashed filename
const ROOT = resolve(process.cwd());

// simple recursive walker to find .html files
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    // skip some heavy/irrelevant dirs
    if (
      e.isDirectory() &&
      ['node_modules', '.git', 'dist', 'build'].includes(e.name)
    ) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile() && /\.html?$/i.test(e.name)) {
      yield full;
    }
  }
}

const patterns = [
  /assets\/js\/main\.[a-f0-9]{8}\.js/g, // previous hashed
  /assets\/js\/main\.tmp\.js/g,         // temp file (if referenced)
  /assets\/js\/main\.js/g,              // un-hashed fallback
];

for await (const filePath of walk(ROOT)) {
  let contents = await fs.readFile(filePath, 'utf8');
  const before = contents;
  for (const rx of patterns) {
    contents = contents.replace(rx, `assets/js/${finalName}`);
  }
  if (contents !== before) {
    await fs.writeFile(filePath, contents, 'utf8');
    console.log(`Updated ${filePath} → assets/js/${finalName}`);
  }
}

console.log(`Built ${finalPath}`);
