import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadDotEnv, dataRoot, readJsonFile } from './util.js';
loadDotEnv();

import { loadConfig } from './config.js';
import { runAether } from './agent.js';
import { ollamaHealthy } from './ollama.js';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const cfg = loadConfig();
const app = new Hono();

app.use('*', async (c, next) => {
  if (c.req.path === '/health' || c.req.path === '/ready') return next();
  if (!cfg.token) return next();
  const auth = c.req.header('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const hdr = c.req.header('x-aether-token') || '';
  if (bearer === cfg.token || hdr === cfg.token) return next();
  return c.json({ error: 'unauthorized' }, 401);
});

app.get('/health', async (c) => {
  const ollama = cfg.ollama ? await ollamaHealthy(cfg.ollamaHost) : false;
  return c.json({
    ok: true,
    service: 'aether-ai',
    version: '0.1.0',
    independent: true,
    notFounderOS: true,
    capabilities: {
      textReasoning: true,
      ollama,
      exa: Boolean(cfg.exaKey),
      research: true,
      osint: true,
      training: true,
      imageGeneration: false,
      voiceGeneration: false,
      videoGeneration: false,
      classifiedAccess: false,
    },
    autonomous: cfg.autonomous,
    model: cfg.model,
    dataDir: cfg.dataDir,
  });
});

app.get('/ready', (c) => {
  const latest = readJsonFile<{ level?: string; passRate?: number }>(
    join(dataRoot(), 'training', 'latest.json'),
    {},
  );
  return c.json({
    ok: true,
    agent: 'aether-ai',
    training: latest,
    privateApi: true,
  });
});

const chatBody = z.object({
  text: z.string().min(1).max(12000),
  mode: z
    .enum(['auto', 'chat', 'research', 'osint', 'plan', 'decide', 'code'])
    .optional(),
  sessionId: z.string().optional(),
  dryRun: z.boolean().optional(),
  autonomous: z.boolean().optional(),
});

app.post('/v1/chat', async (c) => {
  const parsed = chatBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const b = parsed.data;
  const result = await runAether({
    text: b.text,
    ...(b.mode ? { mode: b.mode } : {}),
    ...(b.sessionId ? { sessionId: b.sessionId } : {}),
    ...(b.dryRun !== undefined ? { dryRun: b.dryRun } : {}),
    ...(b.autonomous !== undefined ? { autonomous: b.autonomous } : {}),
  });
  return c.json({ ok: true, ...result });
});

app.get('/v1/missions', (c) => {
  const dir = join(dataRoot(), 'missions');
  if (!existsSync(dir)) return c.json({ ok: true, missions: [] });
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).slice(0, 30);
  const missions = files.map((f) => readJsonFile(join(dir, f), { id: f }));
  return c.json({ ok: true, missions });
});

console.log(
  `Aether AI http://${cfg.host}:${cfg.port} data=${cfg.dataDir} autonomous=${cfg.autonomous}`,
);
serve({ fetch: app.fetch, hostname: cfg.host, port: cfg.port });
