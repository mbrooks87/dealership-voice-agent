// Local test harness — simulates Vapi tool calls against the running server
// without a live phone call. Start the server (`npm run dev`), then `npm run simulate`.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.VAPI_WEBHOOK_SECRET;

interface Scenario {
  label: string;
  tool: string;
  args: Record<string, unknown>;
}

const scenarios: Scenario[] = [
  { label: "Caller asks about Tellurides", tool: "check_inventory", args: { model: "Telluride" } },
  { label: "Used SUV under 30k", tool: "check_inventory", args: { condition: "used", bodyStyle: "SUV", maxPrice: 30000 } },
  { label: "Something we don't carry", tool: "check_inventory", args: { model: "Mustang" } },
  { label: "Details on stock K6412", tool: "get_vehicle_details", args: { stockNumber: "K6412" } },
  { label: "Details on a sold-pending unit", tool: "get_vehicle_details", args: { stockNumber: "K6350" } },
  { label: "Bad stock number", tool: "get_vehicle_details", args: { stockNumber: "ZZZ999" } },
  {
    label: "Oil change appointment",
    tool: "create_service_request",
    args: {
      name: "Marcus Webb",
      phone: "770-555-0142",
      vehicleYearMakeModel: "2022 Kia Telluride",
      serviceType: "oil change and tire rotation",
      preferredWindow: "Thursday morning",
    },
  },
  {
    label: "Sales lead with trade-in",
    tool: "create_sales_lead",
    args: {
      name: "Dana Ellis",
      phone: "404-555-0187",
      interest: "new Sportage Hybrid",
      timeframe: "this weekend",
      tradeIn: "2018 Honda CR-V",
    },
  },
  { label: "Service hours", tool: "get_hours_and_location", args: { department: "service" } },
  { label: "All hours + directions", tool: "get_hours_and_location", args: {} },
  { label: "Pricing question → transfer", tool: "transfer_to_human", args: { department: "sales", reason: "pricing question" } },
  { label: "Missing required lead fields (should fail gracefully)", tool: "create_sales_lead", args: { name: "No Phone" } },
];

async function run() {
  let failures = 0;
  for (const s of scenarios) {
    const payload = {
      message: {
        type: "tool-calls",
        call: { id: "simulated-call-001" },
        toolCallList: [
          { id: `tc_${s.tool}`, function: { name: s.tool, arguments: s.args } },
        ],
      },
    };
    try {
      const res = await fetch(`${BASE_URL}/vapi/tools`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(SECRET ? { "x-vapi-secret": SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { results?: { result: string }[] };
      const result = body.results?.[0]?.result ?? JSON.stringify(body);
      console.log(`\n■ ${s.label}  [${s.tool}] → HTTP ${res.status}`);
      console.log(`  ${result}`);
      if (res.status !== 200) failures++;
    } catch (err) {
      console.error(`\n■ ${s.label}  [${s.tool}] → FAILED: ${err}`);
      failures++;
    }
  }
  console.log(`\n${scenarios.length - failures}/${scenarios.length} scenarios returned HTTP 200.`);
  if (failures > 0) process.exit(1);
}

run();
