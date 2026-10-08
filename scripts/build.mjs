import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
execFileSync(process.execPath, [fileURLToPath(new URL('./build-static.js', import.meta.url))], { stdio: 'inherit' });
await import('./build-worker.mjs');
