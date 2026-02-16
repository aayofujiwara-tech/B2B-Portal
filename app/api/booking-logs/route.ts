import { NextResponse } from "next/server";

const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || "";

interface BookingLogEntry {
  id: string;
  timestamp: string;
  facilityName: string;
  contactName: string;
  phone: string;
  email: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// メモリキャッシュ（サーバーレス関数のライフタイム中は保持される）
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 1000; // 60秒
let cache: { data: BookingLogEntry[]; timestamp: number } | null = null;

async function readBookingLogsFromGAS(): Promise<BookingLogEntry[]> {
  const url = `${GAS_WEBHOOK_URL}?action=readReceptionLogs`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });

  if (!res.ok) {
    throw new Error(`GAS GET failed: ${res.status}`);
  }

  const data = await res.json();
  return data as BookingLogEntry[];
}

// ---------------------------------------------------------------------------
// GET /api/booking-logs — 受付ログ一覧を返す
// ---------------------------------------------------------------------------
export async function GET() {
  if (!GAS_WEBHOOK_URL) {
    console.warn("[booking-logs] GAS_WEBHOOK_URL が未設定です");
    return NextResponse.json([]);
  }

  // キャッシュが有効期限内ならキャッシュから即返す
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await readBookingLogsFromGAS();
    // キャッシュを更新
    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    console.error("[booking-logs] GAS 読み込みエラー:", e);
    // GAS接続エラー時: 期限切れキャッシュがあればフォールバック
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json([], { status: 500 });
  }
}
