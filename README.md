# Aether AI

Independent text reasoning agent — **not** FounderOS / FounderAI.

## Start

```powershell
cd E:\FounderOS\source\aether-ai
npm install
copy .env.example .env
# set EXA_API_KEY, AETHER_TOKEN optional
npm run build
npm run chat
npm run start:api
npm run train
npm run train:loop
```

Default API: `http://127.0.0.1:8788`  
Data: `E:/AetherAI/data` (or `AETHER_DATA_DIR`)

## Stop train loop

Create file: `E:/AetherAI/data/training/STOP`

## Ported from FounderAI experiments

Reasoning so-what · Exa research · OSINT angles · train gym · autonomous routine mode

## Dropped

FounderOS product plan (see PLAN_DROP_FOUNDEROS.md)
