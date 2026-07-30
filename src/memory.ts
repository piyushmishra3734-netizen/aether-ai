import { join } from 'node:path';
import {
  dataRoot,
  nowIso,
  readJsonFile,
  truncate,
  writeJsonFile,
} from './util.js';

export type MemoryState = {
  notes: string[];
  lastGoal: string | null;
  decisions: string[];
  mistakes: string[];
  updatedAt: string;
};

function path(): string {
  return join(dataRoot(), 'memory', 'long-term.json');
}

function empty(): MemoryState {
  return {
    notes: [],
    lastGoal: null,
    decisions: [],
    mistakes: [],
    updatedAt: nowIso(),
  };
}

export function loadMemory(): MemoryState {
  return readJsonFile(path(), empty());
}

export function saveMemory(m: MemoryState): void {
  m.updatedAt = nowIso();
  writeJsonFile(path(), m);
}

export function memoryBrief(): string {
  const m = loadMemory();
  const parts: string[] = [];
  if (m.lastGoal) parts.push(`goal: ${truncate(m.lastGoal, 100)}`);
  if (m.decisions[0]) parts.push(`decision: ${truncate(m.decisions[0], 80)}`);
  if (m.mistakes[0]) parts.push(`mistake: ${truncate(m.mistakes[0], 80)}`);
  if (m.notes[0]) parts.push(`note: ${truncate(m.notes[0], 80)}`);
  return parts.join(' · ') || 'empty memory';
}

export function recordGoal(goal: string): void {
  const m = loadMemory();
  m.lastGoal = truncate(goal, 500);
  m.notes = [truncate(goal, 200), ...m.notes].slice(0, 40);
  saveMemory(m);
}

export function recordDecision(text: string): void {
  const m = loadMemory();
  m.decisions = [truncate(text, 400), ...m.decisions].slice(0, 50);
  saveMemory(m);
}

export function recordMistake(text: string): void {
  const m = loadMemory();
  m.mistakes = [truncate(text, 400), ...m.mistakes].slice(0, 40);
  saveMemory(m);
}
