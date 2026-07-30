import type { EvidenceItem } from './types.js';
import { nowIso, truncate, uid } from './util.js';

const EXA_BASE = 'https://api.exa.ai';

export async function exaSearch(opts: {
  apiKey: string;
  query: string;
  numResults?: number;
  startPublishedDate?: string;
  endPublishedDate?: string;
}): Promise<EvidenceItem[]> {
  const body: Record<string, unknown> = {
    query: opts.query.slice(0, 500),
    type: 'auto',
    numResults: opts.numResults ?? 8,
    contents: {
      text: { maxCharacters: 1400 },
      highlights: true,
    },
  };
  if (opts.startPublishedDate) body.startPublishedDate = opts.startPublishedDate;
  if (opts.endPublishedDate) body.endPublishedDate = opts.endPublishedDate;

  const res = await fetch(`${EXA_BASE}/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Exa HTTP ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      highlights?: string[];
      publishedDate?: string;
      score?: number;
    }>;
  };
  const ts = nowIso();
  return (data.results ?? []).map((r) => {
    const text =
      typeof r.text === 'string'
        ? r.text
        : Array.isArray(r.highlights)
          ? r.highlights.join(' ')
          : '';
    const item: EvidenceItem = {
      id: uid('exa'),
      claim: truncate(`${r.title ?? r.url ?? 'hit'}: ${text}`, 520),
      source: 'exa:web_search',
      polarity: 'supports',
      trustScore: Math.min(0.92, 0.55 + (r.score ?? 0.2)),
      confidence: 0.7,
      collectedAt: r.publishedDate ?? ts,
    };
    if (r.url) item.url = r.url;
    return item;
  });
}
