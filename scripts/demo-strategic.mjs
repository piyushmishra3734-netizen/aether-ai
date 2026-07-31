import { loadDotEnv } from '../dist/util.js';
loadDotEnv();
import { runAether } from '../dist/agent.js';
import { loadConfig } from '../dist/config.js';

const r = await runAether(
  {
    text: 'OSINT strategic forecast DPRK coastal maritime intention next 30 days',
    mode: 'strategic',
    dryRun: true,
  },
  { ...loadConfig(), ollama: false },
);
console.log(r.response.slice(0, 2000));
console.log('\n--- conf', r.confidence, 'kind', r.intent.kind);
