/**
 * Unlimited live fire — real Exa multi-angle + strategic brief (no dryRun).
 * Usage: node scripts/fire-live-strategic.mjs [query...]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadDotEnv } from '../dist/util.js';
loadDotEnv();

import { runAether } from '../dist/agent.js';
import { loadConfig } from '../dist/config.js';

const query =
  process.argv.slice(2).join(' ').trim() ||
  'OSINT strategic forecast DPRK North Korea coastal maritime ports Wonsan Nampo intention and activity next 30 days multi-source open source';

const cfg = { ...loadConfig(), ollama: false, autonomous: true };
console.log('LIVE FIRE strategic OSINT');
console.log('query=', query.slice(0, 160));
console.log('exa=', Boolean(cfg.exaKey), 'data=', cfg.dataDir);

const t0 = Date.now();
const r = await runAether({
  text: query,
  mode: 'strategic',
  dryRun: false,
  autonomous: true,
  sessionId: `live_${Date.now().toString(16)}`,
});

const outDir = join(cfg.dataDir, 'missions', 'reports');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const mdPath = join(outDir, `live-strategic-${stamp}.md`);
const jsonPath = join(outDir, `live-strategic-${stamp}.json`);

const md = [
  r.response,
  '',
  '---',
  `durationMs: ${r.durationMs}`,
  `evidence: ${r.evidence?.length ?? 0}`,
  `stages: ${(r.stages || []).join('→')}`,
  `wallMs: ${Date.now() - t0}`,
].join('\n');

writeFileSync(mdPath, md, 'utf8');
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      query,
      conf: r.confidence,
      factors: r.confidenceFactors,
      evidenceCount: r.evidence?.length,
      evidence: r.evidence,
      stages: r.stages,
      durationMs: r.durationMs,
      response: r.response,
    },
    null,
    2,
  ),
  'utf8',
);

console.log('\n======== BRIEF (first 2500 chars) ========\n');
console.log(r.response.slice(0, 2500));
console.log('\n======== META ========');
console.log({
  conf: r.confidence,
  evidence: r.evidence?.length,
  durationMs: r.durationMs,
  mdPath,
  jsonPath,
});
