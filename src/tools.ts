import { z } from "zod";
import { dealership, getDepartment } from "./config.js";
import { search, getByStockOrVin, type Vehicle } from "./inventory.js";
import { logLead } from "./leads.js";

// Every handler returns a plain string — Vapi speaks the tool result to the
// caller, so results are written for the ear, not the eye. No prices, ever:
// pricing questions transfer to a human (see the system prompt).

function speakVehicle(v: Vehicle): string {
  const availability =
    v.status === "sold_pending"
      ? "sale pending"
      : v.status === "in_transit"
        ? "arriving soon"
        : "on the lot now";
  const mileage =
    v.condition === "used" ? `${Math.round(v.mileage / 1000)} thousand miles, ` : "";
  return `a ${v.year} ${v.model} ${v.trim} in ${v.exteriorColor}, ${mileage}${availability}, stock number ${v.stockNumber}`;
}

// A caller can't absorb a 20-item feature dump. Pick the few that sell the
// car out loud: powertrain character, comfort headliners, then tech/safety.
const FEATURE_PRIORITY = [
  "electric",
  "hybrid",
  "range",
  "turbo",
  "horsepower",
  "all-wheel",
  "captain",
  "third row",
  "seating",
  "sunroof",
  "panoramic",
  "ventilated",
  "heated",
  "leather",
  "audio",
  "navigation",
  "charging",
  "tow",
  "certified",
  "one owner",
];

function pickFeatures(features: string[], max = 4): string[] {
  const score = (f: string) => {
    const i = FEATURE_PRIORITY.findIndex((k) => f.toLowerCase().includes(k));
    return i === -1 ? FEATURE_PRIORITY.length : i;
  };
  return features
    .map((f, i) => ({ f, i, s: score(f) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.f);
}

const checkInventorySchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  trim: z.string().optional(),
  maxPrice: z.coerce.number().optional(),
  bodyStyle: z.string().optional(),
  condition: z.string().optional(),
});

const vehicleDetailsSchema = z
  .object({
    stockNumber: z.string().optional(),
    vin: z.string().optional(),
  })
  .refine((a) => a.stockNumber || a.vin, {
    message: "stockNumber or vin is required",
  });

const serviceRequestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  vehicleYearMakeModel: z.string().min(1),
  serviceType: z.string().min(1),
  preferredWindow: z.string().min(1),
  notes: z.string().optional(),
});

const salesLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  interest: z.string().min(1),
  timeframe: z.string().min(1),
  tradeIn: z.string().optional(),
  notes: z.string().optional(),
});

const hoursSchema = z.object({
  department: z.string().optional(),
});

const transferSchema = z.object({
  department: z.string().min(1),
  reason: z.string().optional(),
});

export const handlers: Record<
  string,
  (args: unknown, callId?: string) => Promise<string>
> = {
  async check_inventory(rawArgs) {
    const args = checkInventorySchema.parse(rawArgs ?? {});
    const matches = search(args);
    if (matches.length === 0) {
      return "No exact matches in our current inventory. Offer to take their information so a specialist can confirm what's available or arriving soon, and text them options.";
    }
    // Never more than 3 — the caller can't hold more in their head.
    const top = matches.slice(0, 3);
    const extra = matches.length - 3;
    const more =
      extra > 0
        ? ` There ${extra === 1 ? "is 1 more like it" : `are ${extra} more like these`} — offer to have a specialist text them the full list.`
        : "";
    return `Found ${matches.length} match${matches.length === 1 ? "" : "es"}. Top options: ${top.map(speakVehicle).join("; ")}.${more}`;
  },

  async get_vehicle_details(rawArgs) {
    const args = vehicleDetailsSchema.parse(rawArgs ?? {});
    const v = getByStockOrVin(args.stockNumber ?? args.vin ?? "");
    if (!v) {
      return "That stock number or VIN isn't in our current inventory records. Offer to take their information so a specialist can look it up and call them back.";
    }
    const availability =
      v.status === "sold_pending"
        ? "It has a sale pending — a specialist can confirm whether it is still available."
        : v.status === "in_transit"
          ? "It is in transit to the dealership — a specialist can confirm the arrival date."
          : "It is on the lot and available right now.";
    return `Stock ${v.stockNumber}: ${v.year} ${v.make} ${v.model} ${v.trim}, ${v.condition}, ${v.exteriorColor} exterior with ${v.interiorColor} interior, ${v.mileage.toLocaleString()} miles. Key features: ${pickFeatures(v.features).join(", ")}. ${availability}`;
  },

  async create_service_request(rawArgs, callId) {
    const args = serviceRequestSchema.parse(rawArgs);
    await logLead("service", args, callId);
    return `Service request logged for ${args.name}: ${args.serviceType} on their ${args.vehicleYearMakeModel}, preferred ${args.preferredWindow}. Tell the caller the service team will confirm the exact appointment time, and read their phone number ${args.phone} back to them to confirm it.`;
  },

  async create_sales_lead(rawArgs, callId) {
    const args = salesLeadSchema.parse(rawArgs);
    await logLead("sales", args, callId);
    return `Sales lead logged for ${args.name}, interested in ${args.interest}, timeframe ${args.timeframe}${args.tradeIn ? `, possible trade-in: ${args.tradeIn}` : ""}. Tell the caller a product specialist will follow up shortly, and read their phone number ${args.phone} back to them to confirm it.`;
  },

  async get_hours_and_location(rawArgs) {
    const args = hoursSchema.parse(rawArgs ?? {});
    if (args.department) {
      const dept = getDepartment(args.department);
      return `${dept.label} hours: ${dept.hours}. We're located at ${dealership.address}. ${dealership.directions}`;
    }
    const all = Object.values(dealership.departments)
      .map((d) => `${d.label}: ${d.hours}`)
      .join(". ");
    return `${all}. We're located at ${dealership.address}. ${dealership.directions}`;
  },

  async transfer_to_human(rawArgs) {
    const args = transferSchema.parse(rawArgs);
    const dept = getDepartment(args.department);
    return `Transferring to ${dept.label} at ${dept.transferNumber}. Tell the caller you're connecting them now to someone who can help${args.reason ? ` with ${args.reason}` : ""}.`;
  },
};

// get_hours alias — the short demo spec named it get_hours, the roadmap names
// it get_hours_and_location. Accept both so either tool definition works.
handlers.get_hours = handlers.get_hours_and_location;
