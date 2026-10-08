// Both hosting and the local server use this explicit public-asset manifest.
const fs = require('node:fs/promises');
const path = require('node:path');
const files = require('../public-files.json');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');

async function build() {
  if (path.dirname(output) !== root || path.basename(output) !== 'public') throw new Error('Invalid build directory');
  await fs.rm(output, { recursive: true, force: true });
  for (const file of files) {
    const source = path.resolve(root, file), dest = path.resolve(output, file);
    if (!source.startsWith(root + path.sep) || !dest.startsWith(output + path.sep)) throw new Error('Invalid asset path');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(source, dest);
  }
  console.log('Built ' + files.length + ' public assets. Server code and private data are excluded.');
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
