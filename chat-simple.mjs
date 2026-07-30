#!/usr/bin/env node
/**
 * Aether AI — pure-Node chat (no tsx, no npm scripts).
 * Offline-first: always answers. Optional Ollama (12s) + optional Exa.
 *
 *   node chat-simple.mjs
 *   echo hello | node chat-simple.mjs
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OLLAMA_TIMEOUT_MS = 8_000;
const OLLAMA_HEALTH_MS = 2_500;
const EXA_TIMEOUT_MS = 8_000;
/** After one Ollama failure this session, stay offline (fast). */
let ollamaDisabledThisSession = false;

// ── .env ──────────────────────────────────────────────────────────
function loadDotEnv(file = join(ROOT, '.env')) {
  try {
    if (!existsSync(file)) return;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([^#=\s][^=]*)=(.*)$/.exec(line);
      if (!m) continue;
      const k = m[1].trim();
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}
loadDotEnv();

const DATA_DIR =
  process.env.AETHER_DATA_DIR?.trim() || join('E:', 'AetherAI', 'data');
const OLLAMA_HOST = (
  process.env.OLLAMA_HOST?.trim() || 'http://127.0.0.1:11434'
).replace(/\/$/, '');
const MODEL =
  process.env.AETHER_MODEL?.trim() ||
  process.env.OLLAMA_MODEL?.trim() ||
  'llama3.2:3b';
const WANT_OLLAMA = process.env.AETHER_OLLAMA !== '0';
const EXA_KEY =
  process.env.EXA_API_KEY?.trim() ||
  process.env.AETHER_EXA_API_KEY?.trim() ||
  null;

function ensureDir(p) {
  try {
    mkdirSync(p, { recursive: true });
  } catch {
    /* ignore */
  }
}
ensureDir(DATA_DIR);
ensureDir(join(DATA_DIR, 'memory'));
ensureDir(join(DATA_DIR, 'logs'));

function truncate(s, n) {
  const t = String(s || '').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

// ── memory (tiny) ─────────────────────────────────────────────────
function memPath() {
  return join(DATA_DIR, 'memory', 'long-term.json');
}
function loadMem() {
  try {
    if (!existsSync(memPath())) return { notes: [], lastGoal: null };
    return JSON.parse(readFileSync(memPath(), 'utf8'));
  } catch {
    return { notes: [], lastGoal: null };
  }
}
function memoryBrief() {
  const m = loadMem();
  const parts = [];
  if (m.lastGoal) parts.push(`goal: ${truncate(m.lastGoal, 80)}`);
  if (m.notes?.[0]) parts.push(`note: ${truncate(m.notes[0], 80)}`);
  return parts.join(' · ') || 'empty memory';
}

// ── offline reason (always works) ─────────────────────────────────
function offlineReply(text) {
  const lower = text.toLowerCase().trim();
  const mem = memoryBrief();

  if (/^(h+i+|h+l+o+|hey|hello|namaste|yo|salam)[\s!.,]*$/i.test(lower)) {
    return `Hey - Aether AI here (offline). Ask anything: research, OSINT, plans, decisions, code. Memory: ${mem}`;
  }
  if (/\b(status|health|capabilities|kya kar)\b/i.test(lower) && text.length < 80) {
    return [
      'Aether AI online (text reasoning agent).',
      'Capabilities: chat, research, OSINT packaging, plan/decide, optional Ollama + Exa.',
      'Not FounderOS. No media gen. No classified hacks.',
      mem !== 'empty memory' ? `Memory: ${mem}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (
    /\b(hack into|classified|illegal access|steal classified)\b/i.test(text)
  ) {
    return 'Refused: illegal or classified access is out of scope. Restate as a legal open-source research question.';
  }
  if (
    /\b(generat(e|ing)|creat(e|ing)|make|render)\b/i.test(text) &&
    /\b(image|video|voice|audio|mp4|png|photo)\b/i.test(text)
  ) {
    return 'Aether AI does not generate images, voice, or video. I help with text reasoning, research, planning, and code advice.';
  }

  return [
    '## Direct answer',
    `On: ${truncate(text, 280)}`,
    '',
    '## Conclusion',
    'Working offline (local reasoner). Structure your goal, list constraints, pick the smallest reversible next step.',
    '',
    '## Options',
    'A) Clarify goal in one sentence',
    'B) Break into 3 milestones with kill-criteria',
    'C) Research competitors / open sources (use /research or type "research: …")',
    '',
    `Memory: ${mem}`,
  ].join('\n');
}

// ── optional Ollama (short timeout) ───────────────────────────────
async function ollamaHealthy() {
  if (!WANT_OLLAMA) return false;
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_HEALTH_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ollamaChat(userText) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'You are Aether AI — independent text reasoning agent. Not FounderOS. No media gen. Be direct.',
          },
          { role: 'user', content: userText },
        ],
        options: { temperature: 0.35 },
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data?.message?.content?.trim() || '';
    return text.length > 20
      ? { ok: true, text }
      : { ok: false, error: 'empty model response' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

// ── optional Exa (research-ish lines) ─────────────────────────────
async function tryExa(query) {
  if (!EXA_KEY || EXA_KEY.length < 8) return null;
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': EXA_KEY,
      },
      signal: AbortSignal.timeout(EXA_TIMEOUT_MS),
      body: JSON.stringify({
        query: truncate(query, 200),
        numResults: 4,
        type: 'auto',
        contents: { text: { maxCharacters: 400 } },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = (data.results || []).slice(0, 4).map((r, i) => {
      const title = r.title || r.url || 'result';
      const url = r.url ? ` (${r.url})` : '';
      return `${i + 1}. ${truncate(title, 120)}${url}`;
    });
    return rows.length ? rows.join('\n') : null;
  } catch {
    return null;
  }
}

function wantsResearch(text) {
  return /\b(research|osint|latest|news|competitor|market|sources?)\b/i.test(
    text,
  );
}

function isSimpleTurn(text) {
  const lower = text.toLowerCase().trim();
  if (text.length < 48) return true;
  if (/^(h+i+|h+l+o+|hey|hello|namaste|yo|salam|status|health)[\s!.,?]*$/i.test(lower))
    return true;
  if (/\b(status|health|capabilities|kya kar)\b/i.test(lower) && text.length < 80)
    return true;
  return false;
}

// ── reply pipeline (offline-first — always answers fast) ──────────
async function reply(text) {
  const offline = offlineReply(text);
  let evidence = null;
  if (wantsResearch(text)) {
    process.stdout.write('... research (optional)\n');
    evidence = await tryExa(text);
  }

  // Simple turns: pure offline (instant). No Ollama wait.
  const tryOllama =
    WANT_OLLAMA &&
    !ollamaDisabledThisSession &&
    !isSimpleTurn(text);

  if (tryOllama) {
    process.stdout.write(`... thinking (Ollama <=${OLLAMA_TIMEOUT_MS / 1000}s, then offline)\n`);
    const healthy = await ollamaHealthy();
    if (healthy) {
      const r = await ollamaChat(text);
      if (r.ok) {
        const bits = [r.text.trim()];
        if (evidence) bits.push('', '## Live web (Exa)', evidence);
        bits.push('', `- Aether · ollama/${MODEL}`);
        return bits.join('\n');
      }
      ollamaDisabledThisSession = true;
      const bits = [
        offline,
        '',
        `_(Ollama skipped after: ${r.error || 'unavailable'} — offline for rest of session)_`,
      ];
      if (evidence) bits.push('', '## Live web (Exa)', evidence);
      bits.push('', '- Aether · offline · stages offline-reason');
      return bits.join('\n');
    }
    ollamaDisabledThisSession = true;
  } else {
    process.stdout.write('... thinking (offline)\n');
  }

  const bits = [offline];
  if (evidence) bits.push('', '## Live web (Exa)', evidence);
  bits.push('', '- Aether · offline · stages offline-reason');
  return bits.join('\n');
}

// ── main loop ─────────────────────────────────────────────────────
async function main() {
  // Windows console: try UTF-8 (best-effort; Chat-Aether.cmd also sets chcp 65001)
  try {
    if (process.platform === 'win32') {
      output.setDefaultEncoding?.('utf8');
    }
  } catch {
    /* ignore */
  }

  console.log('');
  console.log('  ================================================');
  console.log('   AETHER AI — Simple Chat (pure Node)');
  console.log('  ================================================');
  console.log('   Type your message and press Enter.');
  console.log('   Hindi: Apna message likho, Enter dabao.');
  console.log('   Exit:  /quit  or  /exit');
  console.log(
    `   data=${DATA_DIR} ollama=${WANT_OLLAMA} model=${MODEL} exa=${Boolean(EXA_KEY && EXA_KEY.length >= 8)}`,
  );
  console.log('  ================================================');
  console.log('');
  console.log('  >>> Type and press Enter <<<');
  console.log('');

  const rl = readline.createInterface({ input, output });

  while (true) {
    let line;
    try {
      line = (await rl.question('aether> ')).trim();
    } catch {
      break;
    }
    if (!line) {
      if (input.readableEnded) break;
      continue;
    }
    if (line === '/quit' || line === '/exit') break;

    try {
      const t0 = Date.now();
      const out = await reply(line);
      console.log('\n' + out + '\n');
      console.log(`(${Date.now() - t0}ms)\n`);
      // log last reply for tests
      try {
        writeFileSync(
          join(DATA_DIR, 'logs', 'last-chat-simple.txt'),
          out,
          'utf8',
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error('error', e instanceof Error ? e.message : e);
      console.log('\n' + offlineReply(line) + '\n');
    }
  }
  rl.close();
}

main().catch((e) => {
  console.error('fatal', e instanceof Error ? e.message : e);
  process.exit(1);
});
