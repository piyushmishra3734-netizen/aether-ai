import type { IntentKind, Mode } from './types.js';

export type Classified = {
  kind: IntentKind;
  confidence: number;
  reason: string;
  needsResearch: boolean;
  normalizedText: string;
};

export function classify(text: string, mode: Mode = 'auto'): Classified {
  const body = text.trim();
  const lower = body.toLowerCase();

  if (
    /\b(hack into|classified|illegal access|steal classified|dump targets)\b/i.test(
      body,
    )
  ) {
    return {
      kind: 'refuse',
      confidence: 0.95,
      reason: 'illegal/classified request',
      needsResearch: false,
      normalizedText: body,
    };
  }

  if (
    /\b(generat(e|ing)|creat(e|ing)|make|render)\b/i.test(body) &&
    /\b(image|video|voice|audio|mp4|png|photo)\b/i.test(body)
  ) {
    return {
      kind: 'refuse',
      confidence: 0.95,
      reason: 'media generation forbidden',
      needsResearch: false,
      normalizedText: body,
    };
  }

  if (mode !== 'auto') {
    const map: Record<string, IntentKind> = {
      chat: 'chat',
      research: 'research',
      osint: 'osint',
      plan: 'plan',
      decide: 'decide',
      code: 'code',
    };
    const kind = map[mode] ?? 'chat';
    return {
      kind,
      confidence: 0.99,
      reason: `mode=${mode}`,
      needsResearch: kind === 'research' || kind === 'osint',
      normalizedText: body,
    };
  }

  if (/^(h+i+|h+l+o+|hey|hello|namaste|yo)[\s!.,]*$/i.test(lower)) {
    return {
      kind: 'chat',
      confidence: 0.92,
      reason: 'greeting',
      needsResearch: false,
      normalizedText: body,
    };
  }

  if (/\b(status|health|capabilities|kya kar)\b/i.test(lower) && body.length < 80) {
    return {
      kind: 'status',
      confidence: 0.85,
      reason: 'status',
      needsResearch: false,
      normalizedText: body,
    };
  }

  if (
    /\bosint\b|open[- ]source intel|multi[- ]source|gray.?zone|maritime|sanctions|dprk|coastal/i.test(
      lower,
    )
  ) {
    return {
      kind: 'osint',
      confidence: 0.88,
      reason: 'osint signals',
      needsResearch: true,
      normalizedText: body,
    };
  }

  if (
    /research|investigate|competitor|market size|latest news|2026|evidence|sources?/i.test(
      lower,
    )
  ) {
    return {
      kind: 'research',
      confidence: 0.86,
      reason: 'research signals',
      needsResearch: true,
      normalizedText: body,
    };
  }

  if (/\b(code|implement|refactor|fix|function|typescript|bug|fix)\b/i.test(lower)) {
    return {
      kind: 'code',
      confidence: 0.84,
      reason: 'code signals',
      needsResearch: false,
      normalizedText: body,
    };
  }

  if (/\b(plan|roadmap|milestones?|break down)\b/i.test(lower)) {
    return {
      kind: 'plan',
      confidence: 0.82,
      reason: 'plan signals',
      needsResearch: false,
      normalizedText: body,
    };
  }

  if (/\b(decide|should we|trade-?off|recommend|options?)\b/i.test(lower)) {
    return {
      kind: 'decide',
      confidence: 0.8,
      reason: 'decide signals',
      needsResearch: /market|competitor|pricing/i.test(lower),
      normalizedText: body,
    };
  }

  return {
    kind: 'chat',
    confidence: 0.6,
    reason: 'default chat',
    needsResearch: false,
    normalizedText: body,
  };
}
