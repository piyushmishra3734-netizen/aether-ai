import type { Classified } from './intent.js';
import type { EvidenceItem, PlanStep } from './types.js';
import { ollamaChat } from './ollama.js';
import { truncate } from './util.js';
import { localConversation, qualityOk } from './conversation.js';

const SYSTEM = `You are Aether AI — an independent text reasoning agent (exact name: Aether AI).
You are NOT FounderOS. You do not generate images, voice, or video.
Answer directly first. Then evidence / so-what / options if useful.
Match Hindi/Hinglish when the user uses it. Never call yourself Tara/Tera AI.
Refuse illegal/classified hacking and media generation.`;

export function offlineReason(opts: {
  intent: Classified;
  plan: PlanStep[];
  memoryBrief: string;
  evidence: EvidenceItem[];
  researchSummary?: string;
}): string {
  const { intent, plan, memoryBrief, evidence } = opts;

  // Local-first conversational brain (identity, greetings, simple chat)
  const local = localConversation(intent.normalizedText);
  if (local && (intent.kind === 'chat' || intent.kind === 'status' || intent.kind === 'refuse')) {
    // refuse/media/hack also handled in localConversation
    if (intent.kind === 'refuse' || intent.kind === 'chat' || intent.kind === 'status') {
      if (intent.kind !== 'status' || local.includes('Aether')) {
        // status has dedicated richer path below if local is thin
        if (intent.kind === 'chat' || intent.kind === 'refuse') return local;
      }
    }
  }
  if (local && intent.kind === 'chat') return local;

  if (intent.kind === 'refuse') {
    if (/media/i.test(intent.reason)) {
      return [
        'Aether AI does **not** generate images, voice, or video.',
        'I can help with text reasoning, research, OSINT packaging, planning, and code advice.',
      ].join(' ');
    }
    return [
      'Refused: illegal or classified access is out of scope.',
      'I only use open-source / authorized data. Restate as a legal open-source research question if needed.',
    ].join(' ');
  }

  const ev =
    evidence.length === 0
      ? 'No live evidence rows.'
      : evidence
          .slice(0, 8)
          .map(
            (e, i) =>
              `${i + 1}. [${e.source}] ${truncate(e.claim, 160)}${e.url ? ` (${e.url})` : ''}`,
          )
          .join('\n');

  if (intent.kind === 'status') {
    return (
      local ||
      [
        'Aether AI online (text reasoning agent).',
        'Capabilities: chat, research, OSINT packaging, plan/decide, optional Ollama + Exa.',
        'Not FounderOS. No media gen. No classified hacks.',
        memoryBrief !== 'empty memory' ? `Memory: ${memoryBrief}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  if (intent.kind === 'chat' && intent.normalizedText.length < 40) {
    return (
      local ||
      `Hey — **Aether AI** here. Ask anything (text): research, OSINT, plans, decisions, code. Memory: ${memoryBrief}`
    );
  }

  if (intent.kind === 'code') {
    return [
      '## Direct answer',
      `Code task: ${truncate(intent.normalizedText, 280)}`,
      '',
      '## Approach',
      '1. Define inputs/outputs + edge cases',
      '2. Small pure helper first (no global state)',
      '3. Unit tests for happy path + limits',
      '4. Wire into call site with clear errors',
      '',
      '## Skeleton',
      '```ts',
      '// rate-limit style sketch — adapt to your API',
      'export function createLimiter(max: number, windowMs: number) {',
      '  const hits: number[] = [];',
      '  return () => {',
      '    const now = Date.now();',
      '    while (hits.length && now - hits[0]! > windowMs) hits.shift();',
      '    if (hits.length >= max) return false;',
      '    hits.push(now);',
      '    return true;',
      '  };',
      '}',
      '```',
      '',
      '## Plan',
      plan.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n'),
      '',
      '## Options',
      'A) In-memory (dev)  B) Redis (prod)  C) Edge middleware',
      'Provisional: A for local, B when multi-instance.',
    ].join('\n');
  }

  if (intent.kind === 'plan') {
    return [
      '## Direct answer',
      `Plan for: ${truncate(intent.normalizedText, 280)}`,
      '',
      '## Milestones',
      '1. Scope freeze + kill-criteria',
      '2. Vertical slice (one happy path end-to-end)',
      '3. Hardening (auth, tests, observability)',
      '4. Ship + measure',
      '',
      plan.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n'),
      '',
      '## Options',
      'A) Thin MVP this week  B) Full platform  C) Hold until data',
      'Provisional: A — smallest reversible ship.',
    ].join('\n');
  }

  if (intent.kind === 'decide') {
    return [
      '## Direct answer',
      `Decision: ${truncate(intent.normalizedText, 280)}`,
      '',
      '## Options',
      'A) Usage-based — aligns cost with value; harder forecasting',
      'B) Seat-based — simple sales; caps power users unfairly',
      'C) Hybrid — base seat + metered overage',
      '',
      '## Recommendation',
      'Provisional: **C (hybrid)** for API products — predictable floor + upside.',
      'Kill-criteria: if billing complexity blocks launch in 2 weeks → ship pure usage first.',
      '',
      memoryBrief !== 'empty memory' ? `## Memory\n${memoryBrief}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const domain =
    intent.kind === 'osint'
      ? 'intel'
      : intent.kind === 'research' ||
          /market|saas|competitor|pricing/i.test(intent.normalizedText)
        ? 'business'
        : 'general';

  return [
    `## Direct answer`,
    `Intent: ${intent.kind} (${intent.reason})`,
    `On: ${truncate(intent.normalizedText, 280)}`,
    '',
    opts.researchSummary
      ? `## Collection\n${truncate(opts.researchSummary, 700)}`
      : null,
    `## Evidence\n${ev}`,
    memoryBrief !== 'empty memory' ? `## Memory\n${memoryBrief}` : null,
    plan.length
      ? `## Plan\n${plan.map((p, i) => `${i + 1}. ${p.title}: ${p.description}`).join('\n')}`
      : null,
    '',
    `## Conclusion (so what — ${domain})`,
    evidence.length >= 3
      ? 'Multi-source signals support a working assessment; single-source claims stay provisional.'
      : 'Evidence is thin — hold hard claims; prefer reversible next steps.',
    '',
    '## Why this pattern appears (drivers)',
    domain === 'intel'
      ? 'Structural pressure (sanctions, rivalry, supply) + public signaling + media amplification of outliers.'
      : domain === 'business'
        ? 'Competition copies features; moat is workflow + trust + data loop; pricing encodes risk ownership.'
        : 'Constraints and evidence quality dominate free-form ambition.',
    '',
    '## Implications',
    '- Act on multi-source themes; park single-source noise.',
    '- Prefer continuous watch + structured reports over one-off panic.',
    '',
    '## Options',
    'A) Monitor  B) Push thin workstream with kill-criteria  C) Hold for falsifying signal',
    'Provisional: B when evidence ≥3 independent sources; else A.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function reason(opts: {
  intent: Classified;
  plan: PlanStep[];
  memoryBrief: string;
  evidence: EvidenceItem[];
  researchSummary?: string;
  useOllama: boolean;
  ollamaHost: string;
  model: string;
}): Promise<{ text: string; backend: 'ollama' | 'offline'; model?: string }> {
  const offline = offlineReason(opts);
  if (!opts.useOllama) {
    return { text: offline, backend: 'offline' };
  }

  const user = [
    `Intent: ${opts.intent.kind} — ${opts.intent.normalizedText}`,
    `Memory: ${opts.memoryBrief}`,
    opts.researchSummary ? `Research: ${opts.researchSummary}` : '',
    `Evidence:\n${opts.evidence
      .slice(0, 10)
      .map((e) => `- ${e.claim.slice(0, 200)}`)
      .join('\n')}`,
    'Respond with: Direct answer, evidence synthesis, so-what conclusion, drivers, implications, options. No media gen. No illegal access.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const r = await ollamaChat({
    host: opts.ollamaHost,
    model: opts.model,
    system: SYSTEM,
    user,
    timeoutMs: 20_000,
  });
  if (r.ok && r.text.length > 20 && qualityOk(opts.intent.normalizedText, r.text)) {
    return { text: r.text, backend: 'ollama', model: opts.model };
  }
  return {
    text: offline,
    backend: 'offline',
  };
}
