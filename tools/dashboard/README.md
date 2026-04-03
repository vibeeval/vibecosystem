# vibecosystem Agent Monitoring Dashboard v2.0

Real-time agent monitoring dashboard for vibecosystem.

## Setup

```bash
cd ~/.claude/tools/dashboard
npm install
npm start
```

## Access

- Dashboard UI: http://localhost:3848
- WebSocket + Event API: ws://localhost:3847

## Architecture

```
Claude Code Hooks (PostToolUse)
  |
  | HTTP POST /event (fire-and-forget)
  v
dashboard server.js (port 3847)
  |
  | WebSocket broadcast
  v
index.html (port 3848)
  |
  | fetch /api/*
  v
Canavar error-ledger.jsonl
agent-events.jsonl
skill-matrix.json
```

## Hook Integration

The `dashboard-ws-emitter` hook (PostToolUse) sends events to the dashboard server via HTTP POST.
If the dashboard server is not running, the hook silently skips - zero impact on Claude Code.

Hook source: `~/.claude/hooks/src/dashboard-ws-emitter.ts`
Hook compiled: `~/.claude/hooks/dist/dashboard-ws-emitter.mjs`

To register the hook, add to `~/.claude/settings.json` under `hooks.PostToolUse`:

```json
{
  "matcher": "Agent|Task|Bash",
  "hooks": [
    {
      "type": "command",
      "command": "node ~/.claude/hooks/dist/dashboard-ws-emitter.mjs",
      "timeout": 3
    }
  ]
}
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/errors | Son 50 Canavar error ledger kaydi |
| GET /api/stats | Session istatistikleri |
| GET /api/events | Son 100 in-memory event |
| GET /api/matrix | Canavar skill matrix |
| GET /api/agent-events | agent-events.jsonl son 100 kayit |
| POST /event (port 3847) | Hook event alimi |

## Features

- Agent Timeline: Yatay timeline'da agent baslangic/bitis zamanlari
- Live Feed: Real-time event akisi (all/agents/errors tab)
- Error Panel: Canavar ledger'dan son hatalar
- Stats Panel: Toplam spawn, ortalama sure, hata orani
- Agent Breakdown: Agent tipine gore detay
- Filter: Agent tipine gore filtreleme
- Pause/Resume: Feed'i durdurma/devam ettirme
- Auto-reconnect: WebSocket baglantisi kopunca otomatik yeniden baglanma
