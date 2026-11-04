# vibecosystem dashboard

Optional local activity monitoring for Claude Code. It is started only
when requested with `vibeco dashboard` and is not required by the core profile.
The `dashboard` profile adds activity hooks to core; `full` includes them too.

```bash
vibeco profile dashboard
npm ci --omit=dev --ignore-scripts --prefix ~/.claude/tools/dashboard
vibeco dashboard
```

Open http://127.0.0.1:3848 (or http://localhost:3848). The HTTP UI/API and
WebSocket/event listener bind only to `127.0.0.1`, on ports 3848 and 3847.
Do not expose them through a public proxy. The dashboard is intended for the local
user; it does not authenticate other programs running on the same machine.

The optional `dashboard-ws-emitter` PreToolUse/Agent and PostToolUse hooks send
structural metadata to `POST http://127.0.0.1:3847/event`. Events include the tool name, agent type,
status and session identifier. Raw prompts, shell commands and tool inputs are
excluded. If no server is listening, the hook continues after a bounded timeout.
The `dashboard` and `full` profiles manage hook registration; do not register a
duplicate manually.

Browser requests require a local Host and dashboard Origin; WebSocket upgrades
check both separately. Event ingestion accepts local requests without an Origin,
validates the event shape and limits payloads to 64 KiB. These checks protect
against unrelated web pages connecting to a running local dashboard. They do not
isolate untrusted processes on your computer.

The UI shows the last 1,000 received events (50 on initial WebSocket connection),
agent activity and errors. REST endpoints read local files under `~/.claude`:

| Endpoint | Data |
| --- | --- |
| `/api/errors` | Last 50 error-ledger records |
| `/api/stats` | In-memory counters since dashboard startup |
| `/api/events` | Last 100 received events |
| `/api/matrix` | Skill matrix |
| `/api/agent-events` | Last 100 agent-event log records |
| `/api/tokens` | Recent token estimates and their source |
| `/api/costs` | Legacy illustrative rates; not provider billing data |

Token estimates are not API usage or invoices. PreToolUse Agent events report
starts; PostToolUse events report completed tool calls. A completion received
without a start is shown as a completion marker. A successful response containing
the word “error” is not a failure.

The UI uses checked-in local CSS and system fonts; no third-party scripts or fonts
are loaded. To regenerate CSS after markup changes, run
`npm ci --ignore-scripts --prefix tools/dashboard` then
`npm run build:css --prefix tools/dashboard`. Tailwind is a build-only dependency.

Run `npm test --prefix tools/dashboard` from a checkout for isolated HTTP and real
WebSocket tests. They use a temporary HOME and ephemeral loopback ports. Development
port overrides are `VIBECO_DASHBOARD_HTTP_PORT` and `VIBECO_DASHBOARD_WS_PORT`.
