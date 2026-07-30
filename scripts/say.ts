/**
 * One-shot Aether chat (no server needed).
 * Usage: npx.cmd tsx scripts/say.ts "your message"
 *        npm.cmd run say -- "your message"
 */
import { loadDotEnv } from '../src/util.js';
loadDotEnv();

import { runAether } from '../src/agent.js';

async function main() {
  const text = process.argv.slice(2).join(' ').trim();
  if (!text) {
    console.error('Usage: npm.cmd run say -- "your message"');
    process.exit(1);
  }
  const r = await runAether({
    text,
    mode: 'chat',
    sessionId: `say_${Date.now().toString(16)}`,
  });
  console.log(r.response);
  if (process.env.AETHER_SAY_META === '1') {
    console.error(
      `[meta] ${r.backend} ${r.model} conf=${String(r.confidence).slice(0, 5)} ${r.durationMs}ms`,
    );
  }
}

main().catch((e) => {
  console.error('error', e instanceof Error ? e.message : e);
  process.exit(1);
});
