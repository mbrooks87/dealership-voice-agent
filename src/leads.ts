import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Same dual-depth situation as inventory.ts: src/ under tsx, dist/src/ when
// compiled. Anchor on inventory.json — a bare data/ dir isn't proof of the
// project root, since compiled runs used to mkdir a stray dist/data/.
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDirCandidates = [
  path.join(here, "..", "data"),
  path.join(here, "..", "..", "data"),
];
const dataDir =
  dataDirCandidates.find((d) => existsSync(path.join(d, "inventory.json"))) ??
  dataDirCandidates[0];
const leadsFile = path.join(dataDir, "leads.jsonl");

export interface LeadRecord {
  type: "sales" | "service" | "appointment";
  createdAt: string;
  callId?: string;
  payload: Record<string, unknown>;
}

// One JSON object per line — append-only, so a crash mid-write can't corrupt
// previously logged leads the way rewriting a single JSON array could.
export async function logLead(
  type: LeadRecord["type"],
  payload: Record<string, unknown>,
  callId?: string
): Promise<LeadRecord> {
  const record: LeadRecord = {
    type,
    createdAt: new Date().toISOString(),
    callId,
    payload,
  };
  await mkdir(dataDir, { recursive: true });
  await appendFile(leadsFile, JSON.stringify(record) + "\n", "utf-8");
  return record;
}
