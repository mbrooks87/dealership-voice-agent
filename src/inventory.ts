import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface Vehicle {
  stockNumber: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  condition: "new" | "used";
  mileage: number;
  exteriorColor: string;
  interiorColor: string;
  price: number;
  // Old data files used in_stock/in_transit; the current file uses available.
  status: "available" | "in_stock" | "in_transit" | "sold_pending";
  features: string[];
  drivetrain?: string;
  engine?: string;
  transmission?: string;
  mpg?: string;
  seating?: number;
  towingCapacity?: string;
  warranty?: string;
  range?: number;
  chargingTime?: string;
  certified?: boolean;
  historyReport?: string;
}

// The data file has shipped in two shapes: a bare array with a `price` field,
// and `{ "vehicles": [...] }` with `msrp`. Accept both.
type RawVehicle = Omit<Vehicle, "price"> & { price?: number; msrp?: number };

export interface SearchCriteria {
  make?: string;
  model?: string;
  year?: number;
  trim?: string;
  maxPrice?: number;
  bodyStyle?: string;
  condition?: string;
}

const dataPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "inventory.json"
);

const parsed = JSON.parse(readFileSync(dataPath, "utf-8")) as
  | RawVehicle[]
  | { vehicles: RawVehicle[] };
const rawVehicles = Array.isArray(parsed) ? parsed : parsed.vehicles;
if (!Array.isArray(rawVehicles)) {
  throw new Error(
    `inventory.json must be an array of vehicles or { "vehicles": [...] }`
  );
}
const inventory: Vehicle[] = rawVehicles.map((v) => ({
  ...v,
  price: v.price ?? v.msrp ?? 0,
}));

const contains = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase().trim());

export function search(criteria: SearchCriteria): Vehicle[] {
  return inventory.filter((v) => {
    if (v.status === "sold_pending") return false;
    if (criteria.make && !contains(v.make, criteria.make)) return false;
    if (criteria.model && !contains(v.model, criteria.model)) return false;
    if (criteria.year && v.year !== criteria.year) return false;
    if (criteria.trim && !contains(v.trim, criteria.trim)) return false;
    if (criteria.maxPrice && v.price > criteria.maxPrice) return false;
    if (criteria.bodyStyle && !contains(v.bodyStyle, criteria.bodyStyle)) return false;
    if (criteria.condition && !contains(v.condition, criteria.condition)) return false;
    return true;
  });
}

export function getByStockOrVin(id: string): Vehicle | undefined {
  const needle = id.toLowerCase().trim();
  return inventory.find(
    (v) => v.stockNumber.toLowerCase() === needle || v.vin.toLowerCase() === needle
  );
}
