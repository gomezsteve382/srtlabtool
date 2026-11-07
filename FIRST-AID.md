# FIRST-AID — Wolf Self-Fix Protocol
**The ladder every wolf runs BEFORE reporting a failure. Source: the 2026-11-07 failure ledger — every entry below is a real failure that really happened, with its real fix.**

## THE LADDER (run in order, never skip)
1. **RE-READ THE ERROR VERBATIM.** Never paraphrase. The exact string classifies the failure.
2. **CLASSIFY** using the table below.
3. **APPLY THE KNOWN FIX.** One fix attempt per classification.
4. **RETRY ONCE with the fix.** One retry. Not five.
5. **ESCALATE AS A RECEIPT** if still failing: error verbatim + classification + what you tried. Never a bare "it failed."

## THE TABLE — known failures, known fixes

| Error signature | Class | Fix |
|---|---|---|
| `gateway: empty completion` | transport/model | Gateway returned zero frames. Check: (1) which brain the wolf runs on (cfgFor), (2) zai → the payload may hit their content screen (flappy) — auto-retry once, (3) local → is the model resident? `GET :21434/api/ps` |
| `gateway HTTP 400 code 1214 "messages parameter is illegal"` | **z.ai content screen** — NOT a param bug. The payload tripped their filter (spicy order or unlucky flap) | Retry once (flap); if deterministic → route the step to a 🔒 local-brain wolf (maddog/goatmez-local) |
| `gateway HTTP 404 ... /v1/messages on a zai call` | gateway branch bug | STOP — report verbatim. This was a real daemon bug (branch mismatch); operator fixes code |
| `gateway HTTP 404` on any call | gateway bug | Report verbatim + the exact target payload. Operator checks daemon version |
| `gateway: only thinking arrived, no final answer` | model thinking ate the budget | Narrow the ask. zai lane carries thinking level low + 16k ceiling — a retry usually lands |
| `Failed to fetch` (browser consult) | CORS/transport | Page must be on http://127.0.0.1:8095 (not file://). OLLAMA_ORIGINS=* is set on reaper — if still blocked, report; the gateway detour is the fallback |
| `thinking…` for >10 min, no tokens | model cold-load or queue jam | Check `:21434/api/ps` (resident?) + `top` on reaper (llama-server CPU). If resident and >10 min: report; operator restarts ollama (last resort — it unloads everything) |
| Draft produces a PLAN but no APPROVE button renders | UI/format | The draft ignored the strict STEP contract. Re-draft once; if still prose, treat as ANSWER + note the contract violation |
| UI shows old behavior after a fix | stale assets | Hard-reload; if served via HTTP, the version query (?v=) must match the latest ship |
| Tool call to an MCP server fails `closed stdout` | server died | Re-check GET :8766/mcp manifest. rea specifically needs a live desktop REA session — parked, use another route |
| `No such file or directory: 'node'` in daemon spawns | PATH | Daemon resolves node from /opt/homebrew/bin — report if this reappears (registry regressed) |

## THE RULES BEHIND THE LADDER
- **Two strikes then reroute.** A lane that fails twice on the same step gets abandoned for that step — reroute to a wolf on a different brain class (cloud ↔ local).
- **Errors are receipts.** A verbatim error in the transcript has value; a paraphrased one has none.
- **Never hide a failure inside a retry loop.** Unbounded retries are how 30-second failures become hour-long hangs.
- **Content-screen refusals are not errors** — they're routing signals. Cloud said no → the 🔒 local wolves are the answer. That's why they exist.

*This file grows from the memory ledger: every new failure class that gets a known fix earns a row. The room's first-aid is a living doc — the failure ledger is its source.*
