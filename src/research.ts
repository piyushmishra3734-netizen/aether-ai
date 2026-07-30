import type { EvidenceItem } from './types.js';
import { exaSearch } from './exa.js';
import { nowIso, truncate, uid } from './util.js';

function last7(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function expandAngles(query: string, heavy: boolean): string[] {
  if (!heavy) return [query];
  const { start, end } = last7();
  const angles = [
    query,
    `${truncate(query, 160)} news last 7 days ${start} to ${end}`,
    `${truncate(query, 140)} open source multi-source analysis`,
    `${truncate(query, 140)} timeline of incidents`,
  ];
  if (/\b(dprk|north korea|coastal|maritime|sanctions)\b/i.test(query)) {
    angles.push(
      `maritime shipping sanctions AIS ${start}`,
      `coastal ports Wonsan Nampo activity ${end}`,
    );
  }
  if (/\b(market|saas|competitor|cofounder|agent)\b/i.test(query)) {
    angles.push(
      `AI cofounder agent platform funding pricing ${start}`,
      `startup competitors landscape ${end}`,
    );
  }
  return [...new Set(angles)].slice(0, 6);
}

export async function collectEvidence(opts: {
  query: string;
  apiKey: string | null;
  dryRun?: boolean;
  limit?: number;
}): Promise<{ summary: string; evidence: EvidenceItem[] }> {
  if (opts.dryRun) {
    return {
      summary: 'dryRun — skipped live web',
      evidence: [
        {
          id: uid('ev'),
          claim: `Dry-run placeholder for: ${truncate(opts.query, 160)}`,
          source: 'aether:dry-run',
          polarity: 'neutral',
          trustScore: 0.3,
          confidence: 0.3,
          collectedAt: nowIso(),
        },
      ],
    };
  }

  if (!opts.apiKey) {
    return {
      summary: 'Exa disabled — set EXA_API_KEY for live web',
      evidence: [
        {
          id: uid('ev'),
          claim: `No live web without EXA_API_KEY for: ${truncate(opts.query, 160)}`,
          source: 'aether:no-exa',
          polarity: 'neutral',
          trustScore: 0.25,
          confidence: 0.25,
          collectedAt: nowIso(),
        },
      ],
    };
  }

  const heavy =
    opts.query.length > 80 ||
    /\b(osint|research|market|sanctions|maritime|latest|2026)\b/i.test(opts.query);
  const { start, end } = last7();
  const angles = expandAngles(opts.query, heavy);
  const bag: EvidenceItem[] = [];
  const notes: string[] = [];

  for (const angle of angles) {
    try {
      const hits = await exaSearch({
        apiKey: opts.apiKey,
        query: angle,
        numResults: heavy ? 6 : opts.limit ?? 8,
        startPublishedDate: start,
        endPublishedDate: end,
      });
      bag.push(...hits);
      notes.push(`exa“${truncate(angle, 40)}”=${hits.length}`);
    } catch {
      try {
        const hits = await exaSearch({
          apiKey: opts.apiKey,
          query: angle,
          numResults: 5,
        });
        bag.push(...hits);
        notes.push(`exa-retry=${hits.length}`);
      } catch (e2) {
        notes.push(
          `exa-fail: ${e2 instanceof Error ? e2.message : String(e2)}`.slice(0, 80),
        );
      }
    }
  }

  const seen = new Set<string>();
  const evidence: EvidenceItem[] = [];
  for (const e of bag) {
    const k = (e.url || e.claim).toLowerCase().slice(0, 180);
    if (seen.has(k)) continue;
    seen.add(k);
    evidence.push(e);
  }

  if (!evidence.length) {
    evidence.push({
      id: uid('ev'),
      claim: `No live hits for: ${truncate(opts.query, 160)}`,
      source: 'aether:empty',
      polarity: 'neutral',
      trustScore: 0.2,
      confidence: 0.2,
      collectedAt: nowIso(),
    });
  }

  return {
    summary: `Aether research angles=${angles.length} window=${start}→${end} · ${notes.join(' · ')} · n=${evidence.length}`,
    evidence: evidence.slice(0, heavy ? 28 : 12),
  };
}
