/**
 * Shared conversational brain — local-first, prompt-aligned answers.
 * Used by agent/reason path and mirrored in chat-simple.mjs.
 */

export function isHindiHeavy(text: string): boolean {
  return (
    /[\u0900-\u097F]/.test(text) ||
    /\b(kya|kaisa|kaise|hai|ho|bhai|yaar|nam|naam|bta|bata|kar|rha|raha|nahi|haan|tum|tera|meri|dude|bol|scene)\b/i.test(
      text,
    )
  );
}

/** High-confidence local answers. null = let full reasoner handle. */
export function localConversation(text: string): string | null {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const hindi = isHindiHeavy(raw);

  if (
    /^(h+i+|h+l+o+|hey+|hello|namaste|yo|salam|hola|sup|wassup)([\s!.,?]|$)/i.test(
      lower,
    ) &&
    raw.length < 40
  ) {
    return hindi
      ? 'Hey! Main **Aether AI** hoon — local assistant. Bol kya chahiye: baat, plan, code, research.'
      : "Hey! I'm **Aether AI** — your local assistant. Ask anything: chat, plan, code, research.";
  }

  if (
    /\b(kais[ae]\s*ho|kaisa\s*hai|kaise\s*ho|how\s+are\s+you|how\s+r\s+u|whats?\s*up|kya\s*haal)\b/i.test(
      lower,
    ) ||
    /kaisa hai dude/i.test(lower)
  ) {
    return hindi
      ? 'Main theek hoon, ready help karne ke liye. Tu bata — kya scene hai?'
      : "I'm good and ready. What's up — what do you need?";
  }

  if (
    /\b(tera|tumhara|your)\s*(naam|name)\b/i.test(lower) ||
    /\b(who\s+are\s+you|kya\s+naam|naam\s+b(ata|ta)|name\s*\??)\b/i.test(lower) ||
    /^(naam|name)\s*[?]?\s*$/i.test(lower)
  ) {
    return hindi
      ? 'Mera naam **Aether AI** hai. Main local text assistant hoon — FounderOS nahi. Image/video nahi banata.'
      : "My name is **Aether AI**. I'm a local text assistant (not FounderOS). I don't make images or video.";
  }

  if (/^(lol+|lmao+|haha+|hehe+|😂|🤣|😅)[\s!]*$/i.test(lower)) {
    return hindi
      ? 'Haha theek hai 😄 ab serious baat? Bol kya fix / plan / code chahiye.'
      : 'Haha fair 😄 want something useful — plan, code, or a question?';
  }

  if (/^(thanks|thank\s*you|thx|ty|shukriya|dhanyavad)[\s!.,]*$/i.test(lower)) {
    return hindi ? 'Welcome! Aur kuch chahiye to bol.' : "You're welcome — ask anytime.";
  }

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
      '• Research / OSINT (Exa when configured)',
      '• Continuous train gym',
      '• No image/voice/video · no illegal hacks',
    ].join('\n');
  }

  if (
    (/\b(generat(e|ing)|creat(e|ing)|make|render|bana|banao|banade)\b/i.test(raw) &&
      /\b(image|video|voice|audio|photo|pic|mp4|png|picture|tasveer)\b/i.test(raw)) ||
    /\b(photo|image|video)\s+(bana|generate|create)\b/i.test(raw)
  ) {
    return hindi
      ? 'Main image / video / voice generate nahi karta. Text help: plan, research, code, decisions.'
      : "I don't generate images, video, or voice. I help with text: plan, research, code, decisions.";
  }

  if (/\b(hack into|classified|illegal access|steal classified)\b/i.test(raw)) {
    return 'Refused: illegal / classified access is out of scope. Ask a legal open-source research question.';
  }

  if (/^(ok+|okay|haan|han|theek|thik|cool|nice|great|achha|accha)[\s!.,]*$/i.test(lower)) {
    return hindi ? 'Theek — aage bol kya karna hai.' : 'Cool — what next?';
  }

  if (/^(bye|goodbye|see\s*ya|alvida|chalta)[\s!.,]*$/i.test(lower)) {
    return hindi ? 'Bye! Phir milte hain.' : 'Bye! Ask anytime.';
  }

  // "explain yourself / what are you"
  if (
    /\b(tu\s+kaun|tum\s+kaun|what\s+are\s+you|introduce\s+yourself|apna\s+parichay)\b/i.test(
      lower,
    )
  ) {
    return hindi
      ? 'Main **Aether AI** hoon — independent local reasoning agent. Chat, plan, research, code. FounderOS nahi. Media gen nahi.'
      : "I'm **Aether AI** — independent local reasoning agent. Chat, plan, research, code. Not FounderOS. No media gen.";
  }

  return null;
}

/** Reject weak-model garbage. */
export function qualityOk(userText: string, modelText: string): boolean {
  const t = (modelText || '').trim();
  if (t.length < 2) return false;
  const low = t.toLowerCase();

  if (/\b(tara ai|tera ai|i am tara|i'm tara|my name is tara)\b/i.test(t)) return false;
  if (/\bi am (?!aether)[a-z]{3,12} ai\b/i.test(low) && !/aether/i.test(low)) return false;
  if (/please speak in clear short sentences/i.test(t)) return false;
  if (/here are some simple instructions to get started/i.test(t)) return false;
  if (/revised version of the text/i.test(t)) return false;
  if (
    userText.length < 40 &&
    /\b(order food|weather forecast|google maps|baidu|payment method|cinema)\b/i.test(t)
  ) {
    return false;
  }
  if (/\b(naam|name|who are you)\b/i.test(userText) && !/aether/i.test(t)) return false;
  if (userText.length < 25 && t.length > 500) return false;
  return true;
}

/** Prompt-aligned check: response should address user intent. */
export function promptAligned(
  userText: string,
  response: string,
  kind: string,
): { ok: boolean; reason?: string } {
  const r = response || '';
  const low = r.toLowerCase();
  const u = userText.toLowerCase();

  if (/\b(naam|name)\b/i.test(u) && !/aether/i.test(r)) {
    return { ok: false, reason: 'name_missing_aether' };
  }
  if (/^(h+i+|hello|hey|hlo)/i.test(u.trim()) && r.length < 5) {
    return { ok: false, reason: 'greeting_too_thin' };
  }
  if (kind === 'refuse' && !/refus|not|does not|illegal|image|video|out of scope/i.test(r)) {
    return { ok: false, reason: 'refuse_weak' };
  }
  if (kind === 'plan' && !/plan|milestone|step|option|phase/i.test(r)) {
    return { ok: false, reason: 'plan_unstructured' };
  }
  if (kind === 'decide' && !/option|recommend|provisional|usage|seat|trade/i.test(r)) {
    return { ok: false, reason: 'decide_no_options' };
  }
  if ((kind === 'research' || kind === 'osint') && !/evidence|research|source|conclusion|so what|intel/i.test(r)) {
    return { ok: false, reason: 'research_thin' };
  }
  // never allow wrong identity brands
  if (/\btara ai\b|\btera ai\b/i.test(low)) {
    return { ok: false, reason: 'wrong_identity' };
  }
  return { ok: true };
}
