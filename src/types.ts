export type Mode =
  | 'auto'
  | 'chat'
  | 'research'
  | 'osint'
  | 'strategic'
  | 'forecast'
  | 'plan'
  | 'decide'
  | 'code';

export type IntentKind =
  | 'chat'
  | 'research'
  | 'osint'
  | 'strategic'
  | 'forecast'
  | 'plan'
  | 'decide'
  | 'code'
  | 'status'
  | 'refuse'
  | 'unknown';

export type EvidenceItem = {
  id: string;
  claim: string;
  source: string;
  url?: string;
  polarity: 'supports' | 'contradicts' | 'neutral';
  trustScore: number;
  confidence: number;
  collectedAt: string;
};

export type PlanStep = {
  id: string;
  title: string;
  kind: string;
  description: string;
};

export type AetherRequest = {
  text: string;
  mode?: Mode;
  sessionId?: string;
  dryRun?: boolean;
  autonomous?: boolean;
};

export type AetherResult = {
  runId: string;
  sessionId: string;
  mode: Mode;
  intent: {
    kind: IntentKind;
    confidence: number;
    reason: string;
    needsResearch: boolean;
  };
  plan: PlanStep[];
  response: string;
  confidence: number;
  confidenceFactors: string[];
  evidence: EvidenceItem[];
  stages: string[];
  durationMs: number;
  backend: 'ollama' | 'offline';
  model?: string;
};
