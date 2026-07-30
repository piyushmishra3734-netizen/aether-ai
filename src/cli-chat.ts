import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadDotEnv } from './util.js';
loadDotEnv();

import { runAether } from './agent.js';
import { loadConfig } from './config.js';

async function main() {
  const cfg = loadConfig();
  const rl = readline.createInterface({ input, output });
  console.log('');
  console.log('  AETHER AI — baat karo / talk freely');
  console.log('  Exit: /quit or /exit');
  console.log('  Modes: /chat /research /osint /plan /decide /code /auto');
  console.log(
    `  data=${cfg.dataDir} ollama=${cfg.ollama} model=${cfg.model} exa=${Boolean(cfg.exaKey)}`,
  );
  console.log('');
  let mode: 'auto' | 'chat' | 'research' | 'osint' | 'plan' | 'decide' | 'code' =
    'chat';
  const sessionId = `cli_${Date.now().toString(16)}`;

  while (true) {
    let line: string;
    try {
      line = (await rl.question(`aether(${mode})> `)).trim();
    } catch {
      // stdin closed (pipe/EOF) — exit cleanly
      break;
    }
    if (!line) {
      if (input.readableEnded) break;
      continue;
    }
    if (line === '/quit' || line === '/exit') break;
    if (line.startsWith('/')) {
      const m = line.slice(1).toLowerCase();
      if (['auto', 'chat', 'research', 'osint', 'plan', 'decide', 'code'].includes(m)) {
        mode = m as typeof mode;
        console.log('mode=', mode);
        continue;
      }
      console.log('Unknown command. Modes: /chat /research /osint /plan /decide /code /auto · /quit');
      continue;
    }
    try {
      process.stdout.write('… thinking\n');
      const r = await runAether({
        text: line,
        mode,
        sessionId,
        autonomous: cfg.autonomous,
      });
      console.log('\n' + r.response + '\n');
    } catch (e) {
      console.error('error', e instanceof Error ? e.message : e);
      console.error('(Tip: is Ollama running? ollama serve · model:', cfg.model + ')');
    }
  }
  rl.close();
}

main();
