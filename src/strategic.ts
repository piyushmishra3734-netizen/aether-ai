/**
 * Strategic OSINT / foresight engine — think-tank methodology on OPEN sources only.
 *
 * Scope (hard):
 * - Open-source intelligence (OSINT), public reporting, multi-hypothesis analysis
 * - Intention analysis + forecasting with calibrated confidence
 * - NO classified systems, NO CIA/ISRO secret access, NO illegal collection
 *
 * Methods adapted from public analytic tradecraft:
 * - ACH-style competing hypotheses
 * - Indicators & warnings
 * - Drivers / so-what / implications
 * - Scenario forecasting (base / upside / downside)
 */

import type { EvidenceItem } from './types.js';
import { clamp01, truncate, uid } from './util.js';

export type Hypothesis = {
  id: string;
  label: string;
  prior: number;
  posterior: number;
  supports: string[];
  contradicts: string[];
};

export type ForecastHorizon = '7d' | '30d' | '90d' | '12m';

export type ForecastBand = {
  horizon: ForecastHorizon;
  base: string;
  upside: string;
  downside: string;
  confidence: number;
  killCriteria: string[];
};

export type StrategicAssessment = {
  id: string;
  query: string;
  domain: 'intel' | 'geopolitics' | 'maritime' | 'business' | 'tech' | 'general';
  classification: 'OPEN_SOURCE_ONLY';
  executiveSummary: string;
  keyJudgments: string[];
  competingHypotheses: Hypothesis[];
  primaryHypothesis: string;
  intentAssessment: {
    actor: string;
    likelyIntent: string;
    alternativeIntents: string[];
    confidence: number;
  };
  forecasts: ForecastBand[];
  indicatorsToWatch: string[];
  collectionGaps: string[];
  confidence: number;
  confidenceFactors: string[];
  evidenceUsed: number;
  multiSource: boolean;
};

function domainOf(q: string): StrategicAssessment['domain'] {
  const l = q.toLowerCase();
  if (/\b(dprk|north korea|maritime|coastal|sanctions|ais|port|wonsan|nampo)\b/i.test(l))
    return 'maritime';
  if (/\b(osint|intel|military|gray.?zone|conflict|geopolit)\b/i.test(l)) return 'geopolitics';
  if (/\b(market|saas|competitor|pricing|startup|funding)\b/i.test(l)) return 'business';
  if (/\b(ai|model|agent|software|code|api)\b/i.test(l)) return 'tech';
  if (/\b(intent|forecast|predict|scenario|threat)\b/i.test(l)) return 'intel';
  return 'general';
}

function hostsFromEvidence(evidence: EvidenceItem[]): number {
  const h = new Set<string>();
  for (const e of evidence) {
    if (!e.url) continue;
    try {
      h.add(new URL(e.url).hostname);
    } catch {
      /* ignore */
    }
  }
  return h.size;
}

function buildHypotheses(
  query: string,
  domain: StrategicAssessment['domain'],
  evidence: EvidenceItem[],
): Hypothesis[] {
  const n = evidence.length;
  const multi = hostsFromEvidence(evidence) >= 2;
  const base = multi ? 0.12 : 0.05;
  const signal = clamp01(0.25 + n * 0.04 + (multi ? 0.15 : 0));

  const templates: Record<string, [string, string, string][]> = {
    maritime: [
      [
        'Routine commercial / domestic port activity',
        'Most traffic and reporting consistent with normal ops',
        'Spike language, AIS dark, or sanctions-linked patterns',
      ],
      [
        'Sanctions-evasion / gray-zone maritime facilitation',
        'Ship-to-ship, flag hopping, dark AIS in open reporting',
        'Clear legitimate commercial explanation dominates',
      ],
      [
        'Signaling / readiness posture (not imminent kinetic)',
        'Exercises, coastal logistics without combat indicators',
        'Mass mobilization + strike rhetoric with matching logistics',
      ],
    ],
    geopolitics: [
      [
        'Status-quo competition / deterrence signaling',
        'Rhetoric + limited probes without escalation ladder',
        'New alliance moves or force posture step-change',
      ],
      [
        'Deliberate escalation for bargaining leverage',
        'Tit-for-tat + public deadlines',
        'De-escalatory off-ramps used quickly',
      ],
      [
        'Internal domestic drivers externalized',
        'Leadership narrative focus inward',
        'External military logistics dominate timeline',
      ],
    ],
    business: [
      [
        'Feature race — competitors copy surface UX',
        'Public launches cluster on same features',
        'Moat via data/workflow lock-in appears',
      ],
      [
        'Consolidation / platform bundling',
        'M&A rumors + API pricing pressure',
        'Niche specialists retain premium margins',
      ],
      [
        'Trust/safety becomes buying criteria',
        'Enterprise RFPs emphasize audit + refusal bounds',
        'Pure model quality still wins deals alone',
      ],
    ],
    tech: [
      [
        'Local+tool agents displace pure chatbots',
        'Open tool-use + memory products ship',
        'Foundation model chat remains enough',
      ],
      [
        'Regulation shapes deployment surface',
        'Compliance features dominate roadmaps',
        'Speed-to-ship ignores compliance',
      ],
      [
        'Small specialized models + routing win cost',
        'Hybrid local/cloud patterns proliferate',
        'Only frontier models remain competitive',
      ],
    ],
    intel: [
      [
        'Most-likely: continued observed pattern',
        'Evidence cluster supports continuity',
        'Break in series / new capability indicator',
      ],
      [
        'Intentional deception / dual narrative',
        'Contradictory public lines across channels',
        'Single consistent multi-source story',
      ],
      [
        'Preparation for discrete future option',
        'Logistics without immediate use',
        'Use-or-lose timeline pressure visible',
      ],
    ],
    general: [
      [
        'Baseline continuation',
        'No strong falsifiers in evidence',
        'Clear structural break',
      ],
      [
        'Accelerating change',
        'Multiple independent signals same direction',
        'Signals cancel / noise-dominated',
      ],
      [
        'Low-probability high-impact tail',
        'Weak early indicators only',
        'Strong contrary evidence',
      ],
    ],
  };

  const rows = templates[domain] || templates.general!;
  const hyps: Hypothesis[] = rows.map((row, i) => {
    const prior = i === 0 ? 0.4 : i === 1 ? 0.35 : 0.25;
    const supportBoost = i === 0 ? signal : signal * (0.7 - i * 0.15);
    const posterior = clamp01(prior * 0.5 + supportBoost + base * (1 - i * 0.2));
    return {
      id: uid('h'),
      label: row[0]!,
      prior,
      posterior,
      supports: [
        row[1]!,
        n >= 3 ? `Evidence volume n=${n} open sources` : 'Thin open evidence — provisional',
      ],
      contradicts: [row[2]!],
    };
  });

  // normalize posteriors
  const sum = hyps.reduce((s, h) => s + h.posterior, 0) || 1;
  for (const h of hyps) h.posterior = clamp01(h.posterior / sum);
  hyps.sort((a, b) => b.posterior - a.posterior);
  return hyps;
}

function forecastsFor(
  domain: StrategicAssessment['domain'],
  primary: string,
  conf: number,
): ForecastBand[] {
  const mk = (
    horizon: ForecastHorizon,
    base: string,
    up: string,
    down: string,
    cAdj: number,
  ): ForecastBand => ({
    horizon,
    base,
    upside: up,
    downside: down,
    confidence: clamp01(conf + cAdj),
    killCriteria: [
      'Multi-source contradiction of base case',
      'New hard capability or policy fact invalidates driver set',
    ],
  });

  if (domain === 'maritime') {
    return [
      mk(
        '7d',
        'Coastal/port pattern stays near recent baseline; noise in single-source AIS anecdotes.',
        'Short spike in open shipping anomalies + media amplification.',
        'Apparent quiet; possible reporting lag — do not over-read silence.',
        0.05,
      ),
      mk(
        '30d',
        primary.slice(0, 120) + ' remains most likely unless indicators flip.',
        'Sustained multi-port anomaly cluster in open sources.',
        'Narrative cools; commercial explanations dominate.',
        -0.05,
      ),
      mk(
        '90d',
        'Structural drivers (sanctions pressure, logistics needs) persist; episodic spikes.',
        'Policy shock or major interdiction story reframes traffic.',
        'Normalization if enforcement or weather/season effects dominate.',
        -0.12,
      ),
    ];
  }

  if (domain === 'business' || domain === 'tech') {
    return [
      mk('30d', 'Competitive copy + pricing experiments continue.', 'Breakout distribution channel.', 'Funding winter slows launches.', 0),
      mk('90d', 'Winners consolidate workflow lock-in.', 'New open standard shifts stack.', 'Regulation shock delays enterprise.', -0.05),
      mk('12m', 'Platforms with trust + data loop pull ahead.', 'Commodity model APIs erase moats.', 'Buyer fatigue stalls seats.', -0.1),
    ];
  }

  return [
    mk('7d', 'Near-term: continuation of dominant open narrative.', 'Surprise event compresses timeline.', 'Information drought increases uncertainty.', 0.02),
    mk('30d', `Base: ${truncate(primary, 100)}`, 'Accelerant event validates primary hyp.', 'Falsifier appears in multi-source reporting.', -0.05),
    mk('90d', 'Structural drivers dominate; watch indicator set weekly.', 'Regime/market discontinuity.', 'Mean-reversion to long baseline.', -0.1),
  ];
}

/**
 * Build a think-tank style strategic assessment from open evidence.
 */
export function buildStrategicAssessment(opts: {
  query: string;
  evidence: EvidenceItem[];
  researchSummary?: string;
}): StrategicAssessment {
  const domain = domainOf(opts.query);
  const evidence = opts.evidence || [];
  const multi = hostsFromEvidence(evidence) >= 2;
  const hyps = buildHypotheses(opts.query, domain, evidence);
  const primary = hyps[0]!;
  const n = evidence.length;

  let conf = 0.35 + primary.posterior * 0.35;
  if (n >= 5) conf += 0.1;
  if (multi) conf += 0.12;
  if (n === 0) conf -= 0.15;
  if (n === 1) conf -= 0.08;
  conf = clamp01(conf);

  const factors = [
    `primary_p=${primary.posterior.toFixed(2)}`,
    `evidence_n=${n}`,
    multi ? 'multi_source=true' : 'multi_source=false',
    `domain=${domain}`,
    'classification=OPEN_SOURCE_ONLY',
  ];

  const actor =
    domain === 'maritime'
      ? 'coastal/maritime actors (open-source observed)'
      : domain === 'business' || domain === 'tech'
        ? 'market competitors / platforms'
        : 'observed actor set (open sources)';

  const intentAssessment = {
    actor,
    likelyIntent: primary.label,
    alternativeIntents: hyps.slice(1).map((h) => h.label),
    confidence: clamp01(primary.posterior * 0.9 + (multi ? 0.05 : 0)),
  };

  const keyJudgments = [
    `Most likely hypothesis (${(primary.posterior * 100).toFixed(0)}% weight): ${primary.label}`,
    multi
      ? 'Multiple independent open hosts support a working assessment; single-source claims remain provisional.'
      : 'Open evidence is thin or single-source — hold hard claims; prefer reversible watch postures.',
    'This product uses OPEN sources only — not classified collection, not agency systems.',
    opts.researchSummary
      ? `Collection note: ${truncate(opts.researchSummary, 220)}`
      : 'Collection: local/offline or dry-run evidence bag.',
  ];

  const executiveSummary = [
    `OPEN-SOURCE strategic assessment on: ${truncate(opts.query, 200)}`,
    `Domain=${domain}. Primary: ${primary.label}.`,
    `Intent read (provisional): ${intentAssessment.likelyIntent}.`,
    multi
      ? 'Multi-source open reporting allows a working so-what; still not ground truth.'
      : 'Insufficient multi-source depth for high-confidence prediction.',
  ].join(' ');

  const indicators =
    domain === 'maritime'
      ? [
          'Open AIS dark clusters near known transfer zones',
          'Port congestion / unusual dwell in public port trackers',
          'Sanctions enforcement actions in open press',
          'Satellite imagery vendors publishing coastal changes',
          'State media vs foreign media narrative split',
        ]
      : domain === 'business' || domain === 'tech'
        ? [
            'Pricing page changes',
            'Hiring spikes in GTM/security',
            'Open-source commit velocity',
            'Regulatory proposals',
            'Enterprise case studies quality',
          ]
        : [
            'Frequency of authoritative open reporting',
            'Contradiction rate across hosts',
            'Logistics/policy step-changes in open sources',
            'Market or mobility proxies',
            'Official statements vs third-party confirmation lag',
          ];

  const gaps = [
    'No classified or non-public sensor access (by design)',
    n < 5 ? 'Need denser multi-angle open collection' : 'Need longitudinal baseline for anomaly scoring',
    'Need explicit falsifiers logged weekly',
    'Ground-truth labels unavailable — calibrate on public after-action only',
  ];

  return {
    id: uid('strat'),
    query: opts.query,
    domain,
    classification: 'OPEN_SOURCE_ONLY',
    executiveSummary,
    keyJudgments,
    competingHypotheses: hyps,
    primaryHypothesis: primary.label,
    intentAssessment,
    forecasts: forecastsFor(domain, primary.label, conf),
    indicatorsToWatch: indicators,
    collectionGaps: gaps,
    confidence: conf,
    confidenceFactors: factors,
    evidenceUsed: n,
    multiSource: multi,
  };
}

/** Render assessment as analyst-facing markdown (think-tank brief). */
export function renderStrategicBrief(a: StrategicAssessment): string {
  const hypBlock = a.competingHypotheses
    .map(
      (h, i) =>
        `${i + 1}. **${h.label}** — p≈${(h.posterior * 100).toFixed(0)}%\n` +
        `   - Supports: ${h.supports.join('; ')}\n` +
        `   - Would falsify: ${h.contradicts.join('; ')}`,
    )
    .join('\n');

  const fBlock = a.forecasts
    .map(
      (f) =>
        `### Horizon ${f.horizon} (conf ${(f.confidence * 100).toFixed(0)}%)\n` +
        `- **Base:** ${f.base}\n` +
        `- **Upside:** ${f.upside}\n` +
        `- **Downside:** ${f.downside}\n` +
        `- **Kill-criteria:** ${f.killCriteria.join(' · ')}`,
    )
    .join('\n\n');

  return [
    '# Strategic OSINT Brief (OPEN SOURCE ONLY)',
    '',
    `**Query:** ${a.query}`,
    `**Domain:** ${a.domain} · **Class:** ${a.classification}`,
    `**Confidence:** ${(a.confidence * 100).toFixed(0)}% · multi-source=${a.multiSource} · evidence_n=${a.evidenceUsed}`,
    '',
    '## Executive summary',
    a.executiveSummary,
    '',
    '## Key judgments',
    ...a.keyJudgments.map((k, i) => `${i + 1}. ${k}`),
    '',
    '## Intention assessment',
    `- **Actor frame:** ${a.intentAssessment.actor}`,
    `- **Likely intent:** ${a.intentAssessment.likelyIntent}`,
    `- **Alternatives:** ${a.intentAssessment.alternativeIntents.join(' | ')}`,
    `- **Intent confidence:** ${(a.intentAssessment.confidence * 100).toFixed(0)}%`,
    '',
    '## Competing hypotheses (ACH-style)',
    hypBlock,
    '',
    '## Forecasts (not certainties)',
    fBlock,
    '',
    '## Indicators to watch',
    ...a.indicatorsToWatch.map((x) => `- ${x}`),
    '',
    '## Collection gaps',
    ...a.collectionGaps.map((x) => `- ${x}`),
    '',
    '## Scope boundary',
    '- Open sources / authorized public data only.',
    '- No classified access, no illegal intrusion, no agency secret systems.',
    '- NK coastal work = Phase-1 OSINT packaging; this module = Phase-2 intention + forecast layer.',
    '',
    `— Aether strategic · conf ${a.confidence.toFixed(2)} · ${a.confidenceFactors.join(' · ')}`,
  ].join('\n');
}
