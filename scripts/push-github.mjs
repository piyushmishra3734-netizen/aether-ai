#!/usr/bin/env node
/**
 * Safe auto-push to GitHub (no .env / node_modules / dist).
 * Usage: node scripts/push-github.mjs [optional commit message]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const msg =
  process.argv.slice(2).join(' ').trim() ||
  `chore: auto-push ${new Date().toISOString()}`;

function sh(cmd, args = [], opts = {}) {
  // Windows: avoid shell:true + arg arrays (breaks -m "multi word message")
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...opts,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

function git(args) {
  const bin = process.platform === 'win32' ? 'git.exe' : 'git';
  return sh(bin, args);
}

// Refresh TRAINING_STATUS.md from latest gym report (if present)
const dataDir =
  process.env.AETHER_DATA_DIR?.trim() || join('E:', 'AetherAI', 'data');
const latestPath = join(dataDir, 'training', 'latest.json');
if (existsSync(latestPath)) {
  try {
    const j = JSON.parse(readFileSync(latestPath, 'utf8'));
    const md = [
      '# Aether training status',
      '',
      `- **Updated:** ${j.ts || new Date().toISOString()}`,
      `- **Level:** ${j.level}`,
      `- **Pass:** ${j.passed}/${j.total} (${((j.passRate || 0) * 100).toFixed(1)}%)`,
      `- **Mean conf:** ${(j.meanConf || 0).toFixed(3)}`,
      `- **Weak parts:** ${(j.weakParts || []).join(', ') || 'none'}`,
      `- **Failed:** ${(j.failedIds || []).join(', ') || 'none'}`,
      '',
      j.goal ? `Goal: ${j.goal}` : '',
      '',
      'Continuous train loop keeps re-verifying until `AETHER_DATA_DIR/training/STOP`.',
      '',
    ].join('\n');
    writeFileSync(join(root, 'TRAINING_STATUS.md'), md, 'utf8');
    console.log('wrote TRAINING_STATUS.md');
  } catch (e) {
    console.warn('skip status write', e instanceof Error ? e.message : e);
  }
}

git(['add', '-A']);
// unstage secrets if any
git(['reset', 'HEAD', '--', '.env']);
const st = spawnSync(process.platform === 'win32' ? 'git.exe' : 'git', ['status', '--porcelain'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  windowsHide: true,
});
const dirty = (st.stdout || '').trim();
if (!dirty) {
  console.log('nothing to commit — already clean');
  const push = git(['push', 'origin', 'main']);
  process.exit(push === 0 ? 0 : push);
}

const commit = git([
  '-c',
  'user.email=piyushmishra3734-netizen@users.noreply.github.com',
  '-c',
  'user.name=piyushmishra3734-netizen',
  'commit',
  '-m',
  msg,
]);
if (commit !== 0) {
  console.error('commit failed');
  process.exit(commit);
}

const push = git(['push', 'origin', 'main']);
process.exit(push === 0 ? 0 : push);
