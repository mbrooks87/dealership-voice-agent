import { appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const leadsFile = path.join(dataDir, "leads.jsonl");

export interface LeadRecord {
  type: "sales" | "service";
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
