import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || "";

// data/slots.json — デプロイ時の初期値 (フォールバック用)
const SEED_FILE = path.join(process.cwd(), "data", "slots.json");

interface SlotConfig {
  totalSlots: number;
  usedSlots: number;
  lastReloadDate: string;
  lastReloadTimestamp: string;
  status: "available" | "adjusting";
}

type SlotsData = Record<string, SlotConfig>;

// ---------------------------------------------------------------------------
// メモリキャッシュ（サーバーレス関数のライフタイム中は保持される）
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 1000; // 60秒
let cache: { data: SlotsData; timestamp: number } | null = null;

function readSeedSlots(): SlotsData {
  try {
    const raw = fs.readFileSync(SEED_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** GAS doGet(?action=readSlots) からスロットデータを取得 */
async function readSlotsFromGAS(): Promise<SlotsData> {
  const url = `${GAS_WEBHOOK_URL}?action=readSlots`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });

  if (!res.ok) {
    throw new Error(`GAS GET failed: ${res.status}`);
  }

  // GAS はリダイレクト（302）を返すことがある。fetch は自動追従する。
  const data = await res.json();
  return data as SlotsData;
}

/** GAS doPost(type:"writeSlots") にスロットデータを書き込み */
async function writeSlotsToGAS(data: SlotsData): Promise<void> {
  const res = await fetch(GAS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "writeSlots", body: data }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    throw new Error(`GAS POST failed: ${res.status}`);
  }

  const result = await res.json();
  if (!result.ok) {
    throw new Error(`GAS writeSlots error: ${result.error || "unknown"}`);
  }
}

// ---------------------------------------------------------------------------
// GET /api/slots — 全拠点のスロット設定を返す
// ---------------------------------------------------------------------------
export async function GET() {
  if (!GAS_WEBHOOK_URL) {
    console.warn("[slots] GAS_WEBHOOK_URL が未設定です。初期値を返します");
    return NextResponse.json(readSeedSlots());
  }

  // キャッシュが有効期限内ならキャッシュから即返す
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await readSlotsFromGAS();
    // GAS から空オブジェクトが返った場合（slots シート未作成）は初期値で返す
    if (Object.keys(data).length === 0) {
      return NextResponse.json(readSeedSlots());
    }
    // キャッシュを更新
    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    console.error("[slots] GAS 読み込みエラー:", e);
    // GAS接続エラー時: 期限切れキャッシュがあればフォールバックとして使う
    if (cache) {
      return NextResponse.json(cache.data);
    }
    // キャッシュもなければ data/slots.json からフォールバック
    return NextResponse.json(readSeedSlots());
  }
}

// ---------------------------------------------------------------------------
// POST /api/slots — スロット設定を更新
// Body: { action: "reload", facilityId, totalSlots }
//     | { action: "consume", facilityId }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!GAS_WEBHOOK_URL) {
    return NextResponse.json(
      { error: "GAS_WEBHOOK_URL が未設定です" },
      { status: 500 },
    );
  }

  // 現在のデータを取得
  let data: SlotsData;
  try {
    data = await readSlotsFromGAS();
    // GAS から空が返った場合は初期値を使う
    if (Object.keys(data).length === 0) {
      data = readSeedSlots();
    }
  } catch (e) {
    console.error("[slots] GAS 読み込みエラー:", e);
    return NextResponse.json(
      { error: "Google Sheets からの読み込みに失敗しました", detail: String(e) },
      { status: 500 },
    );
  }

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

    try {
      await writeSlotsToGAS(data);
    } catch (e) {
      console.error("[slots] GAS 書き込みエラー:", e);
      return NextResponse.json(
        { error: "Google Sheets への書き込みに失敗しました", detail: String(e) },
        { status: 500 },
      );
    }
    // 書き込み成功後、キャッシュを即座に更新
    cache = { data, timestamp: Date.now() };
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

        try {
          await writeSlotsToGAS(data);
        } catch (e) {
          console.error("[slots] GAS 書き込みエラー:", e);
          return NextResponse.json(
            { error: "Google Sheets への書き込みに失敗しました", detail: String(e) },
            { status: 500 },
          );
        }
        // 書き込み成功後、キャッシュを即座に更新
        cache = { data, timestamp: Date.now() };
        return NextResponse.json({ ok: true, consumed: id, slots: data });
      }
    }
    return NextResponse.json({ ok: false, reason: "no_slots_available", slots: data });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
