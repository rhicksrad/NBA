import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const outDir = 'assets/js';
const tempOutFile = join(outDir, 'main.tmp.js');

await build({
  entryPoints: ['components/main.ts'],
  bundle: true,
  format: 'esm',
  target: ['es2019'],
  sourcemap: false,
  outfile: tempOutFile,
  minify: true,
});

const fileBuffer = await fs.readFile(tempOutFile);
const hash = createHash('sha256').update(fileBuffer).digest('hex').slice(0, 8);
const finalName = `main.${hash}.js`;
const finalPath = join(outDir, finalName);

const existingFiles = await fs.readdir(outDir);
await Promise.all(
  existingFiles
    .filter((file) => file.startsWith('main.') && file.endsWith('.js') && file !== finalName && file !== 'main.tmp.js')
    .map((file) => fs.unlink(join(outDir, file)))
);

await fs.writeFile(finalPath, fileBuffer);
await fs.unlink(tempOutFile);

const htmlFiles = ['index.html'];
const scriptPattern = /assets\/js\/main\.[a-f0-9]+\.js/g;

await Promise.all(
  htmlFiles.map(async (file) => {
    const filePath = join(process.cwd(), file);
    const contents = await fs.readFile(filePath, 'utf8');
    const updated = contents.replace(scriptPattern, `assets/js/${finalName}`);
    if (updated !== contents) {
      await fs.writeFile(filePath, updated, 'utf8');
      console.log(`Updated ${file} to reference ${finalName}`);
    }
  }),
);

console.log(`Built ${finalPath}`);
