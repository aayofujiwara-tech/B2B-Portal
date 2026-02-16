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
const CACHE_TTL_MS = 60 * 1000; // 60秒
let cache: { data: AssessmentLogEntry[]; timestamp: number } | null = null;

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
  if (!GAS_WEBHOOK_URL) {
    console.warn("[assessment-logs] GAS_WEBHOOK_URL が未設定です");
    return NextResponse.json([]);
  }

  // キャッシュが有効期限内ならキャッシュから即返す
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await readAssessmentLogsFromGAS();
    // キャッシュを更新
    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    console.error("[assessment-logs] GAS 読み込みエラー:", e);
    // GAS接続エラー時: 期限切れキャッシュがあればフォールバック
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json([], { status: 500 });
  }
}
