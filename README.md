# Aether AI

Independent text reasoning agent — **not** FounderOS / FounderAI.

Public repo: https://github.com/piyushmishra3734-netizen/aether-ai

## Official web portal

**https://piyushmishra3734-netizen.github.io/aether-ai/**

1. PC pe API chalao: `npm run start:api`
2. Browser me portal kholo
3. Chat / strategic / forecast modes wahan se

(Portal = GitHub Pages UI · Brain = local API on `:8788`)

## Quick start (from GitHub)

```powershell
git clone https://github.com/piyushmishra3734-netizen/aether-ai.git
cd aether-ai
copy .env.example .env
# optional: set EXA_API_KEY, AETHER_MODEL, AETHER_DATA_DIR
npm install
npm run build
```

### Chat (easiest)

```powershell
npm run chat
# or pure Node (no tsx):
node chat-simple.mjs
# Windows: double-click Chat-Aether.cmd or CHAT.bat
```

Type a message at `aether>`, press Enter. Exit: `/quit`

### API server

```powershell
npm run start:api
# health: http://127.0.0.1:8788/health
# chat:   POST http://127.0.0.1:8788/v1/chat  { "text": "hello" }
```

### Train gym

```powershell
npm run train
npm run train:loop
```

Stop train loop: create file `AETHER_DATA_DIR/training/STOP`  
Default data dir: `E:/AetherAI/data` (or set `AETHER_DATA_DIR`)

## Config (`.env`)

| Key | Meaning |
|-----|---------|
| `AETHER_PORT` | API port (default `8788`) |
| `AETHER_MODEL` | Ollama model (e.g. `tinyllama:latest`, `llama3.2:3b`) |
| `OLLAMA_HOST` | default `http://127.0.0.1:11434` |
| `AETHER_OLLAMA` | set `0` to force offline reasoner |
| `EXA_API_KEY` | live web research (optional) |
| `AETHER_AUTONOMOUS` | `1` = live research when intent needs it |
| `AETHER_TOKEN` | optional bearer for API |
| `AETHER_DATA_DIR` | memory / missions / training path |

## Requirements

- Node.js 20+
- Optional: [Ollama](https://ollama.com) for local LLM
- Optional: [Exa](https://exa.ai) API key for live web

## Strategic OSINT (Phase-2)

NK coastal multi-source packaging was **Phase-1**. Phase-2 adds think-tank methods on **open sources only**:

- Competing hypotheses (ACH-style)
- Intention assessment
- Forecasts (7d / 30d / 90d) with kill-criteria
- Indicators to watch

```powershell
npm run chat:full
# modes: /osint  /strategic  /forecast
```

Hard boundary: **OPEN SOURCE ONLY** — no CIA/ISRO secret systems, no classified hacks. See `SCOPE_OSINT.md`.

## Scope

- Text reasoning, research/OSINT packaging, plan/decide, strategic forecast, train gym
- **No** image / voice / video generation
- **No** illegal or classified access

## Status

See `STATUS.md`. Train gym target: **A1_ready** (10/10 scenarios).

## GitHub push

Standing order: keep pushing improvements + training status.

```powershell
npm run push
# or:
node scripts/push-github.mjs "your message"
```

`train:loop` also auto-pushes `TRAINING_STATUS.md` every 5 cycles (`AETHER_PUSH_EVERY=5`).

## Dropped

FounderOS product plan — see `PLAN_DROP_FOUNDEROS.md`
