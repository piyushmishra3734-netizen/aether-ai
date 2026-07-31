import { loadConfig, type AetherConfig } from './config.js';
import { classify } from './intent.js';
import {
  memoryBrief,
  recordDecision,
  recordGoal,
  recordMistake,
} from './memory.js';
import { collectEvidence } from './research.js';
import { reason } from './reason.js';
import {
  buildStrategicAssessment,
  renderStrategicBrief,
} from './strategic.js';
import type { AetherRequest, AetherResult, Mode, PlanStep } from './types.js';
import { clamp01, nowIso, truncate, uid, writeJsonFile } from './util.js';
import { join } from 'node:path';
import { ollamaHealthy } from './ollama.js';

function planFor(kind: string, text: string, needsResearch: boolean): PlanStep[] {
  const steps: PlanStep[] = [
    {
      id: uid('step'),
      title: 'Understand',
      kind: 'think',
      description: `Classify and frame: ${truncate(text, 120)}`,
    },
    {
      id: uid('step'),
      title: 'Memory',
      kind: 'memory',
      description: 'Load long-term notes and last goals',
    },
  ];
  if (
    needsResearch ||
    kind === 'research' ||
    kind === 'osint' ||
    kind === 'strategic' ||
    kind === 'forecast'
  ) {
    steps.push(
      {
        id: uid('step'),
        title: 'Collect',
        kind: 'research',
        description: 'Multi-angle open-source collection (Exa when configured)',
      },
      {
        id: uid('step'),
        title: 'Synthesize',
        kind: 'research',
        description: 'Evidence → so-what → drivers → options',
      },
    );
  }
  if (kind === 'strategic' || kind === 'forecast' || kind === 'osint') {
    steps.push({
      id: uid('step'),
      title: 'Strategic layer',
      kind: 'strategic',
      description:
        'ACH hypotheses · intention · forecasts · indicators (OPEN SOURCE ONLY)',
    });
  }
  if (kind === 'plan') {
    steps.push({
      id: uid('step'),
      title: 'Decompose',
      kind: 'plan',
      description: 'Milestones with kill-criteria',
    });
  }
  if (kind === 'decide') {
    steps.push({
      id: uid('step'),
      title: 'Options',
      kind: 'decide',
      description: 'A/B/C with provisional recommendation',
    });
  }
  if (kind === 'code') {
    steps.push({
      id: uid('step'),
      title: 'Code path',
      kind: 'code',
      description: 'Reason about implementation',
    });
  }
  steps.push({
    id: uid('step'),
    title: 'Respond',
    kind: 'review',
    description: 'Direct answer + uncertainty',
  });
  return steps;
}

export async function runAether(
  request: AetherRequest,
  cfg: AetherConfig = loadConfig(),
): Promise<AetherResult> {
  const t0 = Date.now();
  const runId = uid('run');
  const sessionId = request.sessionId?.trim() || uid('sess');
  const mode: Mode = request.mode ?? 'auto';
  const stages: string[] = [];

  const autonomous = request.autonomous === true || cfg.autonomous;
  const dryRun =
    request.dryRun === true ? true : autonomous ? false : Boolean(request.dryRun);

  stages.push('intent');
  const intent = classify(request.text, mode);

  stages.push('memory');
  const mem = memoryBrief();
  if (intent.kind === 'plan' || intent.kind === 'code' || intent.kind === 'decide') {
    recordGoal(intent.normalizedText);
  }

  stages.push('plan');
  const plan = planFor(intent.kind, intent.normalizedText, intent.needsResearch);

  let evidence = [] as AetherResult['evidence'];
  let researchSummary: string | undefined;

  if (intent.needsResearch && intent.kind !== 'refuse') {
    stages.push('research');
    const bag = await collectEvidence({
      query: intent.normalizedText,
      apiKey: cfg.exaKey,
      dryRun,
      limit: 10,
    });
    evidence = bag.evidence;
    researchSummary = bag.summary;
    stages.push('evidence');
  }

  stages.push('reason');
  const strategicKinds = new Set(['osint', 'strategic', 'forecast']);
  const useStrategic = strategicKinds.has(intent.kind);

  let response: string;
  let conf: number;
  let factors: string[];
  let backend: 'ollama' | 'offline' = 'offline';
  let model: string | undefined;

  if (useStrategic) {
    stages.push('strategic');
    const assessment = buildStrategicAssessment({
      query: intent.normalizedText,
      evidence,
      ...(researchSummary ? { researchSummary } : {}),
    });
    response = renderStrategicBrief(assessment);
    conf = assessment.confidence;
    factors = assessment.confidenceFactors;
    backend = 'offline';

    // persist strategic assessment always (even dry-run) for train feedback
    const sid = assessment.id;
    writeJsonFile(join(cfg.dataDir, 'missions', `${sid}-strategic.json`), {
      ...assessment,
      runId,
      sessionId,
      dryRun,
      createdAt: nowIso(),
    });
  } else {
    const ollamaOn =
      cfg.ollama && intent.kind !== 'refuse'
        ? await ollamaHealthy(cfg.ollamaHost)
        : false;

    const reasoned = await reason({
      intent,
      plan,
      memoryBrief: mem,
      evidence,
      ...(researchSummary ? { researchSummary } : {}),
      useOllama: ollamaOn,
      ollamaHost: cfg.ollamaHost,
      model: cfg.model,
    });

    conf = 0.45 + intent.confidence * 0.25;
    if (evidence.length >= 3) conf += 0.15;
    if (evidence.length === 0 && intent.needsResearch && !dryRun) conf -= 0.1;
    if (reasoned.backend === 'ollama') conf += 0.08;
    if (intent.kind === 'refuse') conf = 0.9;
    conf = clamp01(conf);
    factors = [
      `intent ${intent.confidence.toFixed(2)}`,
      `evidence n=${evidence.length}`,
      `backend ${reasoned.backend}`,
      dryRun ? 'dryRun' : 'live',
      autonomous ? 'autonomous' : 'interactive',
    ];
    response = reasoned.text.trim();
    backend = reasoned.backend;
    if (reasoned.model) model = reasoned.model;
  }

  response = [
    response,
    '',
    `— Aether · conf ${conf.toFixed(2)} · ${backend}${model ? `/${model}` : ''} · stages ${stages.join('→')}`,
  ].join('\n');

  if (intent.kind === 'decide' && conf >= 0.45) {
    recordDecision(truncate(response, 300));
  }
  if (intent.needsResearch && evidence.length < 2 && !dryRun) {
    recordMistake(`thin evidence for: ${truncate(intent.normalizedText, 120)}`);
  }

  if (
    !dryRun &&
    (intent.kind === 'osint' ||
      intent.kind === 'research' ||
      intent.kind === 'strategic' ||
      intent.kind === 'forecast') &&
    evidence.length >= 2
  ) {
    const mid = uid('mission');
    const path = join(cfg.dataDir, 'missions', `${mid}.json`);
    const hosts = new Set<string>();
    for (const e of evidence) {
      if (!e.url) continue;
      try {
        hosts.add(new URL(e.url).hostname);
      } catch {
        /* ignore */
      }
    }
    writeJsonFile(path, {
      id: mid,
      title: truncate(intent.normalizedText, 120),
      status: hosts.size >= 2 ? 'completed' : 'partial',
      runId,
      confidence: conf,
      evidenceCount: evidence.length,
      multiSource: hosts.size >= 2,
      summary: truncate(response, 2000),
      createdAt: nowIso(),
      path,
      evidence,
    });
  }

  stages.push('respond');

  const result: AetherResult = {
    runId,
    sessionId,
    mode,
    intent: {
      kind: intent.kind,
      confidence: intent.confidence,
      reason: intent.reason,
      needsResearch: intent.needsResearch,
    },
    plan,
    response,
    confidence: conf,
    confidenceFactors: factors,
    evidence,
    stages,
    durationMs: Date.now() - t0,
    backend,
  };
  if (model) result.model = model;
  return result;
}
