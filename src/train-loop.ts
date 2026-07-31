/**
 * Continuous train until Owner creates STOP file.
 * Runs multi-part gym every cycle; logs weak parts; short pause between cycles.
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { loadDotEnv, dataRoot, ensureDir, nowIso } from './util.js';

loadDotEnv();
const data = dataRoot();
ensureDir(join(data, 'training'));
ensureDir(join(data, 'logs'));
const stop = join(data, 'training', 'STOP');
const log = join(data, 'logs', 'train-loop.log');
const INTERVAL_MS = Number(process.env.AETHER_TRAIN_INTERVAL_MS || 45_000);

function L(m: string) {
  writeFileSync(log, `${nowIso()} ${m}\n`, { flag: 'a' });
  console.log(m);
}

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });
    p.on('exit', (c) => resolve(c ?? 1));
  });
}

function readLatest(): {
  level?: string;
  passRate?: number;
  weakParts?: string[];
  failedIds?: string[];
} {
  try {
    const p = join(data, 'training', 'latest.json');
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  L('AETHER_TRAIN_LOOP_START continuous multi-part → G1_grok_aligned');
  L(`STOP_FILE=${stop}`);
  L(`INTERVAL_MS=${INTERVAL_MS}`);
  let cycle = 0;
  let bestRate = 0;
  let consecutiveFull = 0;

  while (true) {
    if (existsSync(stop)) {
      L('STOP detected — exit');
      break;
    }
    cycle += 1;
    L(`CYCLE_${cycle} train multi-part gym`);
    const code = await run('npx', ['tsx', 'src/train.ts']);
    const latest = readLatest();
    const rate = latest.passRate ?? 0;
    if (rate > bestRate) bestRate = rate;
    if (latest.level === 'G1_grok_aligned' || latest.level === 'A1_ready') {
      consecutiveFull += 1;
    } else {
      consecutiveFull = 0;
    }

    const status = {
      ts: nowIso(),
      cycle,
      lastExit: code,
      level: latest.level,
      passRate: rate,
      bestRate,
      consecutiveFull,
      weakParts: latest.weakParts || [],
      failedIds: latest.failedIds || [],
      goal: 'every part prompt-aligned until Grok-class local behavior',
    };
    writeFileSync(
      join(data, 'training', 'loop-status.json'),
      JSON.stringify(status, null, 2),
    );
    L(
      `CYCLE_${cycle} exit=${code} level=${latest.level} rate=${(rate * 100).toFixed(1)}% weak=${(latest.weakParts || []).join('|') || 'none'} streak=${consecutiveFull}`,
    );

    // keep training forever until STOP (user order) — even when green, re-verify
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();
