import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { loadDotEnv, dataRoot, ensureDir, nowIso } from './util.js';

loadDotEnv();
const data = dataRoot();
ensureDir(join(data, 'training'));
ensureDir(join(data, 'logs'));
const stop = join(data, 'training', 'STOP');
const log = join(data, 'logs', 'train-loop.log');

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

async function main() {
  L('AETHER_TRAIN_LOOP_START');
  L(`STOP_FILE=${stop}`);
  let cycle = 0;
  while (true) {
    if (existsSync(stop)) {
      L('STOP detected — exit');
      break;
    }
    cycle += 1;
    L(`CYCLE_${cycle} train`);
    const code = await run('npx', ['tsx', 'src/train.ts']);
    L(`CYCLE_${cycle} exit=${code}`);
    writeFileSync(
      join(data, 'training', 'loop-status.json'),
      JSON.stringify({ ts: nowIso(), cycle, lastExit: code }, null, 2),
    );
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

main();
