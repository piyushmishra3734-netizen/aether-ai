/**
 * Continuous live Exa strategic missions until STOP file.
 * STOP: E:/AetherAI/data/training/STOP  (same as train — or LIVE_STOP)
 * Interval default 3 min (uses Exa credits freely when owner enables).
 */
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { loadDotEnv, dataRoot, ensureDir, nowIso } from '../dist/util.js';

loadDotEnv();
const data = dataRoot();
ensureDir(join(data, 'training'));
ensureDir(join(data, 'logs'));
ensureDir(join(data, 'missions', 'reports'));

const stopTrain = join(data, 'training', 'STOP');
const stopLive = join(data, 'training', 'LIVE_STOP');
const log = join(data, 'logs', 'live-fire-loop.log');
const INTERVAL_MS = Number(process.env.AETHER_LIVE_INTERVAL_MS || 180_000);

const QUERIES = [
  'OSINT strategic forecast DPRK North Korea coastal maritime ports Wonsan Nampo AIS activity intention next 30 days multi-source',
  'OSINT gray zone maritime sanctions evasion ship-to-ship transfer East Asia last 14 days open source',
  'strategic forecast indicators warnings North Korea coastal infrastructure open source imagery analysis next 90 days',
  'OSINT multi-source maritime logistics DPRK Nampo Wonsan Rajin activity timeline last 7 days',
  'forecast intention analysis coastal defense exercises vs commercial traffic North Korea open sources',
];

function L(m) {
  writeFileSync(log, `${nowIso()} ${m}\n`, { flag: 'a' });
  console.log(m);
}

function runNode(script, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });
    p.on('exit', (c) => resolve(c ?? 1));
  });
}

async function main() {
  L('LIVE_FIRE_LOOP_START unlimited Exa strategic missions');
  L(`STOP_LIVE=${stopLive} STOP_TRAIN=${stopTrain} INTERVAL_MS=${INTERVAL_MS}`);
  let cycle = 0;
  while (true) {
    if (existsSync(stopLive) || existsSync(stopTrain)) {
      L('STOP detected — live fire exit');
      break;
    }
    cycle += 1;
    const q = QUERIES[(cycle - 1) % QUERIES.length];
    L(`CYCLE_${cycle} live strategic: ${q.slice(0, 80)}`);
    const code = await runNode('scripts/fire-live-strategic.mjs', [q]);
    writeFileSync(
      join(data, 'training', 'live-fire-status.json'),
      JSON.stringify(
        { ts: nowIso(), cycle, lastExit: code, lastQuery: q },
        null,
        2,
      ),
    );
    L(`CYCLE_${cycle} exit=${code}`);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
