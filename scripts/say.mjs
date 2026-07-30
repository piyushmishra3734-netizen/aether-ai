#!/usr/bin/env node
/**
 * Wrapper: forwards argv to scripts/say.ts via tsx.
 * Usage: node scripts/say.mjs "your message"
 *        npm.cmd run say -- "your message"
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

if (!args.length || !args.join(' ').trim()) {
  console.error('Usage: node scripts/say.mjs "your message"');
  console.error('   or: npm.cmd run say -- "your message"');
  process.exit(1);
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', join(root, 'scripts', 'say.ts'), ...args],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  },
);

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('Failed to start say:', err.message);
  process.exit(1);
});
