# Dealership Voice Agent — Demo Build

Inbound voice AI receptionist for a car dealership. This is the **demo version**: one Fastify service that handles Vapi custom tool calls, reads inventory from a local JSON file (25 mock Kia units), and logs leads to a file. No database, no Redis, no multi-tenancy — those live in the full roadmap spec and get built when there's a signed pilot.

## What's here

```
src/index.ts            Fastify server: POST /vapi/tools, GET /health
src/tools.ts            Six tool handlers (Zod-validated, speech-friendly results)
src/inventory.ts        Inventory search over data/inventory.json
src/leads.ts            Appends leads to data/leads.jsonl
src/config.ts           Dealership name, address, hours, transfer numbers
data/inventory.json     25 mock Kia units (Telluride, Sportage, Sorento, K5, Carnival, EV6, Forte)
prompts/system-prompt.md   Paste into the Vapi assistant's system prompt box
prompts/vapi-tools.json    Tool definitions for the Vapi assistant
scripts/simulate.ts     Local harness — fires 12 simulated tool calls, no phone needed
```

Tools implemented: `check_inventory`, `get_vehicle_details`, `create_service_request`, `create_sales_lead`, `get_hours_and_location` (alias `get_hours`), `transfer_to_human`.

Guardrails baked in: results never include prices, sold-pending units are filtered from search, inventory misses tell the agent to take a lead instead of guessing, and every lead result instructs the agent to read the phone number back.

## Run locally

```bash
npm install
cp .env.example .env       # optionally set VAPI_WEBHOOK_SECRET
npm run dev                # server on http://localhost:3000
```

In a second terminal:

```bash
npm run simulate           # fires all 12 test scenarios and prints the spoken results
```

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**. Railway detects Node and runs `npm install` + `npm start` automatically.
3. Add environment variable `VAPI_WEBHOOK_SECRET` (any long random string).
4. Under **Settings → Networking**, generate a public domain. Note the URL, e.g. `https://your-app.up.railway.app`.
5. Sanity check: `https://your-app.up.railway.app/health` should return `{"status":"ok"}`.

> Note: `data/leads.jsonl` lives on Railway's ephemeral filesystem — leads are also in the deploy logs (every tool invocation is logged), but they're wiped on redeploy. Fine for a demo; the real build writes to Postgres.

## Wire up Vapi

1. **Create the assistant** — Vapi dashboard → Assistants → Create. Model: pick a fast one (e.g. GPT-4o or Claude). Paste the contents of `prompts/system-prompt.md` (below the divider) into the system prompt.
2. **First message**: `Thanks for calling Kia of Smyrna. I'm an automated assistant — I can help with service appointments, checking inventory, or getting you to the right person. How can I help?`
3. **Add the six tools** — Dashboard → Tools → Create Tool (type: Function) for each entry in `prompts/vapi-tools.json`. Set each tool's **Server URL** to `https://your-app.up.railway.app/vapi/tools` and the **Secret** to your `VAPI_WEBHOOK_SECRET`. Then attach all six tools to the assistant.
4. **Transfers**: for a real warm transfer, also add Vapi's built-in **Transfer Call** tool with the department numbers from `src/config.ts` — the `transfer_to_human` custom tool returns the right number, but Vapi's native transfer tool is what actually moves the call.
5. **Phone number** — Dashboard → Phone Numbers → Buy Number (Vapi provisions Twilio for you), then assign the assistant to the number. To use an existing Twilio number instead: in the Twilio console, set the number's Voice webhook to the SIP/TwiML Vapi gives you under "Import Twilio number," or just import the number via Vapi's dashboard with your Twilio credentials.
6. Call the number from your phone.

## Demo script suggestions

- "Do you have any Tellurides?" → 3 matches with stock numbers
- "Tell me about stock K-2501" → full details, no price
- "How much is it?" → refuses, offers transfer to sales
- "I need an oil change Thursday morning" → collects info, logs service request, reads number back
- "What are your service hours?" → hours + directions

## Before the real pilot (roadmap, not built here)

Postgres + Drizzle, multi-tenant config rows, CRM adapters (ADF email → DriveCentric API), real inventory feed with Redis cache, call/transcript persistence from `/vapi/events`, Sentry, tests. The full spec is the build prompt this repo started from — keep it.
