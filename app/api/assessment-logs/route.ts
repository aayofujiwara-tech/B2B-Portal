import { NextResponse } from "next/server";

const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || "";

interface AssessmentLogEntry {
  id: string;
  timestamp: string;
  disease: string;
  adl: string;
  dementiaLevel?: string;
  budget: string;
  result: "acceptable" | "consultation" | "safety_risk";
  reason?: string;
  gender: string;
  timing: string;
}

// ---------------------------------------------------------------------------
// メモリキャッシュ（サーバーレス関数のライフタイム中は保持される）
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 300 * 1000; // 300秒（ポーリング間隔と同期）
let cache: { data: AssessmentLogEntry[]; timestamp: number } | null = null;

/** キャッシュを無効化する（書き込み後に呼び出す） */
export function invalidateAssessmentLogsCache() {
  cache = null;
}

async function readAssessmentLogsFromGAS(): Promise<AssessmentLogEntry[]> {
  const url = `${GAS_WEBHOOK_URL}?action=readAssessmentLogs`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });

  if (!res.ok) {
    throw new Error(`GAS GET failed: ${res.status}`);
  }

  const data = await res.json();
  return data as AssessmentLogEntry[];
}

// ---------------------------------------------------------------------------
// GET /api/assessment-logs — 判定ログ一覧を返す
// ---------------------------------------------------------------------------
export async function GET() {
  const cacheHeaders = {
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=60",
  };

  if (!GAS_WEBHOOK_URL) {
    console.warn("[assessment-logs] GAS_WEBHOOK_URL が未設定です");
    return NextResponse.json([], { headers: cacheHeaders });
  }

  // キャッシュが有効期限内ならキャッシュから即返す
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data, { headers: cacheHeaders });
  }

  try {
    const data = await readAssessmentLogsFromGAS();
    // キャッシュを更新
    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data, { headers: cacheHeaders });
  } catch (e) {
    console.error("[assessment-logs] GAS 読み込みエラー:", e);
    // GAS接続エラー時: 期限切れキャッシュがあればフォールバック
    if (cache) {
      return NextResponse.json(cache.data, { headers: cacheHeaders });
    }
    return NextResponse.json([], { status: 500 });
  }
}
