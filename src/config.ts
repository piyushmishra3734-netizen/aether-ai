import { join } from 'node:path';
import { dataRoot, ensureDir } from './util.js';

export type AetherConfig = {
  host: string;
  port: number;
  token: string | null;
  dataDir: string;
  autonomous: boolean;
  ollama: boolean;
  ollamaHost: string;
  model: string;
  exaKey: string | null;
};

export function loadConfig(): AetherConfig {
  const dataDir = dataRoot();
  ensureDir(dataDir);
  ensureDir(join(dataDir, 'memory'));
  ensureDir(join(dataDir, 'missions'));
  ensureDir(join(dataDir, 'training'));
  ensureDir(join(dataDir, 'logs'));

  const token = process.env.AETHER_TOKEN?.trim() || null;
  const exa =
    process.env.EXA_API_KEY?.trim() ||
    process.env.AETHER_EXA_API_KEY?.trim() ||
    null;

  return {
    host: process.env.AETHER_HOST?.trim() || '127.0.0.1',
    port: Number(process.env.AETHER_PORT || 8788) || 8788,
    token: token && token.length >= 4 ? token : null,
    dataDir,
    autonomous:
      process.env.AETHER_AUTONOMOUS === '1' ||
      process.env.AETHER_AUTONOMOUS === 'true',
    ollama: process.env.AETHER_OLLAMA !== '0',
    ollamaHost: (
      process.env.OLLAMA_HOST?.trim() || 'http://127.0.0.1:11434'
    ).replace(/\/$/, ''),
    model:
      process.env.AETHER_MODEL?.trim() ||
      process.env.OLLAMA_MODEL?.trim() ||
      'llama3.2:3b',
    exaKey: exa && exa.length >= 8 ? exa : null,
  };
}
