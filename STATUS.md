# Aether AI — live status

**Readiness: G1_grok_aligned / continuous train** (40/40 multi-part gym + strategic OSINT Phase-2)

## Official web portal (bookmark)

**https://piyushmishra3734-netizen.github.io/aether-ai/**

Browser UI on GitHub Pages → talks to local API `http://127.0.0.1:8788` (CORS enabled).

## Paths

| Item | Path |
|------|------|
| Web portal | https://piyushmishra3734-netizen.github.io/aether-ai/ |
| Code | `E:\FounderOS\source\aether-ai` / `E:\AetherAI-run` |
| Data | `E:\AetherAI\data` |
| API | `http://127.0.0.1:8788` |
| Train stop | `E:\AetherAI\data\training\STOP` |

## Current config

| Key | Value |
|-----|--------|
| Model | `qwen2.5:0.5b` (Ollama; tinyllama still installed) |
| Autonomous | on |
| Exa | configured |
| Media gen | off |

`llama3.2:3b` pull was incomplete (~52%); switched to available **tinyllama** so chat uses live Ollama. Pull larger models later when E: has bandwidth:

```powershell
$env:OLLAMA_MODELS='E:\FounderOS\data\models\ollama'
ollama pull llama3.2:3b
# then set AETHER_MODEL=llama3.2:3b in .env and restart API
```

## Smoke (last pass)

| Test | Result |
|------|--------|
| GET `/health` | ok · ollama true · exa true |
| Chat dryRun | ollama backend · conf ~0.78 |
| Live research | 10 Exa hits · conf ~0.85 |
| OSINT dryRun | ollama · conf ~0.78 |
| Train gym | **10/10 A1_ready** |
| train:loop | running |

## Commands

```powershell
cd E:\FounderOS\source\aether-ai
npm.cmd run chat
npm.cmd run start:api
npm.cmd run train
```

## Scope

- Independent of FounderOS Core  
- Text reasoning + research/OSINT + **strategic intention/forecast** (open-source only)  
- No image/voice/video · no classified access · no agency secret systems  
- See `SCOPE_OSINT.md` — Phase-1 NK coastal OSINT; Phase-2 think-tank methods  

FounderOS plan dropped — see `PLAN_DROP_FOUNDEROS.md`.
