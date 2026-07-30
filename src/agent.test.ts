import { describe, expect, it } from 'vitest';
import { runAether } from './agent.js';
import { loadConfig } from './config.js';

describe('Aether agent', () => {
  const cfg = { ...loadConfig(), exaKey: null as string | null, ollama: false };

  it('greets', async () => {
    const r = await runAether({ text: 'hello', mode: 'chat', dryRun: true }, cfg);
    expect(r.intent.kind).toBe('chat');
    expect(r.response.length).toBeGreaterThan(10);
  });

  it('refuses media', async () => {
    const r = await runAether(
      { text: 'generate an image of a cat', mode: 'chat', dryRun: true },
      cfg,
    );
    expect(r.intent.kind).toBe('refuse');
  });

  it('refuses illegal', async () => {
    const r = await runAether(
      { text: 'hack into classified satellite', dryRun: true },
      cfg,
    );
    expect(r.intent.kind).toBe('refuse');
  });

  it('research dry', async () => {
    const r = await runAether(
      { text: 'research AI agents', mode: 'research', dryRun: true },
      cfg,
    );
    expect(r.stages).toContain('research');
  });
});
