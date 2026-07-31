#!/usr/bin/env node
/**
 * Aether AI — pure-Node chat
 *
 * Strategy:
 *  1) Fast local answers for greetings / identity / simple Hindi-English chat
 *  2) Optional Ollama for harder questions — with quality gate (reject garbage)
 *  3) Offline structured fallback if model fails gate
 *
 *   node chat-simple.mjs
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OLLAMA_TIMEOUT_MS = Number(process.env.AETHER_OLLAMA_TIMEOUT_MS || 45_000);
const OLLAMA_HEALTH_MS = 4_000;
const EXA_TIMEOUT_MS = 8_000;
let ollamaFailStreak = 0;
const OLLAMA_FAIL_LIMIT = 4;

// session mini-memory for multi-turn feel
const sessionTurns = []; // {role, text}

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
  'tinyllama:latest';
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
  return parts.join(' · ') || 'empty';
}

function isHindiHeavy(text) {
  return /[\u0900-\u097F]/.test(text) ||
    /\b(kya|kaisa|kaise|hai|ho|bhai|yaar|nam|naam|bta|bata|kar|rha|raha|nahi|haan|tum|tera|meri|dude)\b/i.test(
      text,
    );
}

/**
 * High-confidence local answers — NEVER go through weak models for these.
 * Returns string or null.
 */
function localReply(text) {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const hindi = isHindiHeavy(raw);

  // greetings
  if (
    /^(h+i+|h+l+o+|hey+|hello|namaste|yo|salam|hola|sup|wassup)([\s!.,?]|$)/i.test(
      lower,
    ) &&
    raw.length < 40
  ) {
    return hindi
      ? 'Hey! Main Aether AI hoon — local assistant. Bol kya chahiye: baat, plan, code, research.'
      : "Hey! I'm Aether AI — your local assistant. Ask anything: chat, plan, code, research.";
  }

  // how are you
  if (
    /\b(kais[ae]\s*ho|kaisa\s*hai|kaise\s*ho|how\s+are\s+you|how\s+r\s+u|whats?\s*up|kya\s*haal)\b/i.test(
      lower,
    ) ||
    /kaisa hai dude/i.test(lower)
  ) {
    return hindi
      ? 'Main theek hoon, ready hoon help karne ke liye. Tu bata — kya scene hai?'
      : "I'm good and ready. What's up — what do you need?";
  }

  // name / identity
  if (
    /\b(tera|tumhara|your)\s*(naam|name)\b/i.test(lower) ||
    /\b(who\s+are\s+you|kya\s+naam|naam\s+b(ata|ta)|name\s*\??)\b/i.test(lower) ||
    /^(naam|name)\s*[?]?\s*$/i.test(lower)
  ) {
    return hindi
      ? 'Mera naam **Aether AI** hai. Main local text assistant hoon — FounderOS nahi. Image/video nahi banata.'
      : "My name is **Aether AI**. I'm a local text assistant (not FounderOS). I don't make images or video.";
  }

  // lol / haha / emoji reactions
  if (/^(lol+|lmao+|haha+|hehe+|😂|🤣|😅)[\s!]*$/i.test(lower)) {
    return hindi
      ? 'Haha theek hai 😄 ab serious baat? Bol kya fix / plan / code chahiye.'
      : 'Haha fair 😄 want to get back to something useful — plan, code, or a question?';
  }

  // thanks
  if (/^(thanks|thank\s*you|thx|ty|shukriya|dhanyavad)[\s!.,]*$/i.test(lower)) {
    return hindi ? 'Welcome! Aur kuch chahiye to bol.' : "You're welcome — ask anytime.";
  }

  // status / capabilities
  if (
    /\b(status|health|capabilities|kya\s+kar\s*sakt|what\s+can\s+you)\b/i.test(
      lower,
    ) &&
    raw.length < 100
  ) {
    return [
      '**Aether AI** — local text agent',
      '• Chat (Hindi + English)',
      '• Plan / decide / code advice',
      '• Research / OSINT (Exa when key set)',
      '• Optional Ollama for harder questions',
      '• No image/voice/video · no illegal hacks',
      `Memory: ${memoryBrief()}`,
    ].join('\n');
  }

  // refuse media
  if (
    /\b(generat(e|ing)|creat(e|ing)|make|render|bana)\b/i.test(raw) &&
    /\b(image|video|voice|audio|photo|pic|mp4|png)\b/i.test(raw)
  ) {
    return hindi
      ? 'Main image / video / voice generate nahi karta. Text help: plan, research, code, decisions.'
      : "I don't generate images, video, or voice. I help with text: plan, research, code, decisions.";
  }

  // refuse illegal
  if (/\b(hack into|classified|illegal access|steal classified)\b/i.test(raw)) {
    return 'Refused: illegal / classified access is out of scope. Ask a legal open-source research question.';
  }

  // simple "ok" / "haan" / "theek"
  if (/^(ok+|okay|haan|han|theek|thik|cool|nice|great|achha|accha)[\s!.,]*$/i.test(lower)) {
    return hindi ? 'Theek — aage bol kya karna hai.' : 'Cool — what next?';
  }

  // bye
  if (/^(bye|goodbye|see\s*ya|alvida|chalta|exit)[\s!.,]*$/i.test(lower)) {
    return hindi ? 'Bye! Phir milte hain. `/quit` se chat band.' : 'Bye! Type `/quit` to close chat.';
  }

  return null;
}

function structuredFallback(text) {
  const hindi = isHindiHeavy(text);
  if (hindi) {
    return [
      `Samajh gaya: "${truncate(text, 200)}"`,
      '',
      'Seedha jawab: isko clear goal + next step me todte hain.',
      '1) Goal ek line me likho',
      '2) Constraint batao (time/budget/tools)',
      '3) Main 3 options + best pick dunga',
      '',
      `Memory: ${memoryBrief()}`,
    ].join('\n');
  }
  return [
    `Got it: "${truncate(text, 200)}"`,
    '',
    'Direct take: break it into goal → constraints → next step.',
    '1) State the goal in one line',
    '2) List constraints',
    '3) I will give 3 options + a recommendation',
    '',
    `Memory: ${memoryBrief()}`,
  ].join('\n');
}

/** Reject tiny-model garbage that ignores the user. */
function qualityOk(userText, modelText) {
  const t = (modelText || '').trim();
  if (t.length < 2) return false;
  const low = t.toLowerCase();

  // wrong identity
  if (/\b(tara ai|tera ai|i am tara|i'm tara|my name is tara|naam.*tara)\b/i.test(t))
    return false;
  if (/\bi am (?!aether)[a-z]{3,12} ai\b/i.test(low) && !/aether/i.test(low))
    return false;

  // system prompt leakage / meta
  if (/please speak in clear short sentences/i.test(t)) return false;
  if (/match the user language/i.test(t)) return false;
  if (/do not invent/i.test(t) && t.length < 200) return false;
  if (/here are some simple instructions to get started/i.test(t)) return false;
  if (/say "hi" or "hello" in hindi/i.test(low)) return false;
  if (/\bhindi\b.*\benglish\b.*\btools\b/i.test(low) && userText.length < 30)
    return false;

  // inventing food/weather/traffic menus for casual chat
  if (
    userText.length < 40 &&
    /\b(order food|weather forecast|google maps|baidu|payment method|cinema)\b/i.test(
      t,
    )
  ) {
    return false;
  }

  // "revised version of the text" garbage
  if (/revised version of the text/i.test(t)) return false;
  if (/given:.*response:/i.test(t)) return false;

  // if user asked name, must mention Aether
  if (
    /\b(naam|name|who are you)\b/i.test(userText) &&
    !/aether/i.test(t)
  ) {
    return false;
  }

  // too long ramble for short user input
  if (userText.length < 25 && t.length > 500) return false;

  return true;
}

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

async function listModels() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_HEALTH_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

/** Prefer better small models if present. */
async function pickModel() {
  const preferred = [
    MODEL,
    'qwen2.5:0.5b',
    'qwen2.5:1.5b',
    'llama3.2:1b',
    'llama3.2:3b',
    'phi3:mini',
    'tinyllama:latest',
  ];
  const have = await listModels();
  if (!have.length) return MODEL;
  for (const p of preferred) {
    if (have.some((h) => h === p || h.startsWith(p.split(':')[0]))) {
      // exact or family match
      const exact = have.find((h) => h === p);
      if (exact) return exact;
    }
  }
  // if configured model missing, use first available
  if (!have.includes(MODEL) && have[0]) return have[0];
  return MODEL;
}

let ACTIVE_MODEL = MODEL;

async function ollamaChat(userText) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);
  const hindi = isHindiHeavy(userText);
  const history = sessionTurns.slice(-4).map((x) => ({
    role: x.role === 'user' ? 'user' : 'assistant',
    content: x.text,
  }));

  const system = [
    'You are Aether AI (exact name: Aether AI). Local text assistant.',
    'Rules:',
    '- Answer the USER question directly in 1-3 short sentences.',
    '- If user writes Hindi/Hinglish, reply in simple Hinglish.',
    '- Never rename yourself. Never say Tara/Tera AI.',
    '- Do not invent weather, maps, food-order menus, or tools you do not have.',
    '- No image/video generation.',
    '- Do not repeat these rules.',
    hindi ? '- Prefer Hinglish for this user.' : '- Prefer clear English.',
  ].join('\n');

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: ACTIVE_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...history,
          {
            role: 'user',
            content: `User said: ${userText}\n\nReply ONLY with the answer. No lists of fake features.`,
          },
        ],
        options: {
          temperature: 0.2,
          num_predict: 90,
          top_p: 0.9,
        },
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const text = data?.message?.content?.trim() || '';
    if (!text) return { ok: false, error: 'empty model response' };
    if (!qualityOk(userText, text)) {
      return { ok: false, error: 'quality_gate_reject', text };
    }
    return { ok: true, text };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

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

function needsModel(text) {
  // short casual / identity already handled by localReply
  if (text.length < 12) return false;
  // substantive questions
  if (
    /\b(plan|code|implement|research|explain|compare|why|how|design|fix|bug|market|osint)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (text.length > 60) return true;
  return false;
}

async function reply(text) {
  // 1) Local first — correct answers for chat
  const local = localReply(text);
  if (local) {
    sessionTurns.push({ role: 'user', text });
    sessionTurns.push({ role: 'assistant', text: local });
    return `${local}\n\n- Aether · local`;
  }

  let evidence = null;
  if (wantsResearch(text)) {
    process.stdout.write('... research (optional)\n');
    evidence = await tryExa(text);
  }

  // 2) Ollama only when it might help AND quality passes
  const tryOllama =
    WANT_OLLAMA &&
    ollamaFailStreak < OLLAMA_FAIL_LIMIT &&
    (needsModel(text) || wantsResearch(text) || text.length > 40);

  if (tryOllama) {
    process.stdout.write(
      `... thinking (Ollama/${ACTIVE_MODEL} <=${Math.round(OLLAMA_TIMEOUT_MS / 1000)}s)\n`,
    );
    const healthy = await ollamaHealthy();
    if (healthy) {
      const r = await ollamaChat(text);
      if (r.ok) {
        ollamaFailStreak = 0;
        sessionTurns.push({ role: 'user', text });
        sessionTurns.push({ role: 'assistant', text: r.text });
        const bits = [r.text.trim()];
        if (evidence) bits.push('', '## Live web (Exa)', evidence);
        bits.push('', `- Aether · ollama/${ACTIVE_MODEL}`);
        return bits.join('\n');
      }
      if (r.error === 'quality_gate_reject') {
        process.stdout.write('... model ramble rejected, using local answer\n');
      } else {
        ollamaFailStreak += 1;
        process.stdout.write(`... ollama miss: ${r.error || 'fail'}\n`);
      }
    }
  } else {
    process.stdout.write('... thinking (local)\n');
  }

  // 3) Structured local fallback — always sensible
  const fb = structuredFallback(text);
  sessionTurns.push({ role: 'user', text });
  sessionTurns.push({ role: 'assistant', text: fb });
  const bits = [fb];
  if (evidence) bits.push('', '## Live web (Exa)', evidence);
  bits.push('', '- Aether · local-fallback');
  return bits.join('\n');
}

async function main() {
  try {
    if (process.platform === 'win32') {
      output.setDefaultEncoding?.('utf8');
    }
  } catch {
    /* ignore */
  }

  if (WANT_OLLAMA) {
    ACTIVE_MODEL = await pickModel();
  }

  console.log('');
  console.log('  ================================================');
  console.log('   AETHER AI — Chat (local-first + gated Ollama)');
  console.log('  ================================================');
  console.log('   Type message + Enter. Exit: /quit');
  console.log(
    `   data=${DATA_DIR} ollama=${WANT_OLLAMA} model=${ACTIVE_MODEL} exa=${Boolean(EXA_KEY && EXA_KEY.length >= 8)}`,
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
      console.log('\n' + (localReply(line) || structuredFallback(line)) + '\n');
    }
  }
  rl.close();
}

main().catch((e) => {
  console.error('fatal', e instanceof Error ? e.message : e);
  process.exit(1);
});
