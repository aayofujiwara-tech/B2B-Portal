import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SLOTS_FILE = path.join(process.cwd(), "data", "slots.json");

interface SlotConfig {
  totalSlots: number;
  usedSlots: number;
  lastReloadDate: string;
  lastReloadTimestamp: string;
  status: "available" | "adjusting";
}

type SlotsData = Record<string, SlotConfig>;

function readSlots(): SlotsData {
  try {
    const raw = fs.readFileSync(SLOTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSlots(data: SlotsData): void {
  fs.writeFileSync(SLOTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// GET /api/slots — return all facility slot configs
export async function GET() {
  const data = readSlots();
  return NextResponse.json(data);
}

// POST /api/slots — update slot config for a facility
// Body: { action: "reload", facilityId, totalSlots } or { action: "consume", facilityId }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = readSlots();

  if (body.action === "reload") {
    const { facilityId, totalSlots } = body;
    if (!facilityId || typeof totalSlots !== "number") {
      return NextResponse.json({ error: "invalid params" }, { status: 400 });
    }
    data[facilityId] = {
      totalSlots,
      usedSlots: 0,
      lastReloadDate: new Date().toISOString().split("T")[0],
      lastReloadTimestamp: new Date().toISOString(),
      status: totalSlots > 0 ? "available" : "adjusting",
    };
    writeSlots(data);
    return NextResponse.json({ ok: true, slots: data });
  }

  if (body.action === "consume") {
    const { facilityId } = body;
    const ids =
      facilityId && facilityId !== "any"
        ? [facilityId]
        : ["tsukamoto", "utajima", "toyoshin"];

    for (const id of ids) {
      const slot = data[id];
      if (slot && slot.usedSlots < slot.totalSlots) {
        slot.usedSlots += 1;
        if (slot.usedSlots >= slot.totalSlots) slot.status = "adjusting";
        writeSlots(data);
        return NextResponse.json({ ok: true, consumed: id, slots: data });
      }
    }
    return NextResponse.json({ ok: false, reason: "no_slots_available", slots: data });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
