export async function ollamaChat(opts: {
  host: string;
  model: string;
  system: string;
  user: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; text: string; error?: string }> {
  // CLI-friendly default: fail fast to offline reason instead of looking frozen
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(`${opts.host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.model,
        stream: false,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        options: { temperature: 0.35 },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return {
        ok: false,
        text: '',
        error: `HTTP ${res.status} ${err.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim() || '';
    return text
      ? { ok: true, text }
      : { ok: false, text: '', error: 'empty model response' };
  } catch (e) {
    return {
      ok: false,
      text: '',
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

export async function ollamaHealthy(host: string): Promise<boolean> {
  try {
    const res = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
