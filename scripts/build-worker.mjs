import { readFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = JSON.parse(await readFile(path.join(root, 'public-files.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const assets = {};
for (const file of files) {
  const contents = await readFile(path.join(root, file));
  const binary = path.extname(file) === '.png';
  assets[file] = { content: contents.toString(binary ? 'base64' : 'utf8'), binary, type: types[path.extname(file)] };
}
await build({ entryPoints: [path.join(root, 'worker/index.mjs')], outfile: path.join(root, 'dist/server/index.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, define: { __STATIC_ASSETS__: JSON.stringify(assets) }, legalComments: 'inline' });
await mkdir(path.join(root, 'dist/.openai'), { recursive: true });
await copyFile(path.join(root, '.openai/hosting.json'), path.join(root, 'dist/.openai/hosting.json'));
console.log('Built self-contained Worker with ' + files.length + ' public assets; no runtime credentials embedded.');
