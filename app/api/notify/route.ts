import { NextRequest, NextResponse } from "next/server";
import { invalidateAssessmentLogsCache } from "@/app/api/assessment-logs/route";
import { invalidateBookingLogsCache } from "@/app/api/booking-logs/route";

const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || "";

export async function POST(req: NextRequest) {
  if (!GAS_WEBHOOK_URL) {
    console.warn("[notify] GAS_WEBHOOK_URL が未設定です");
    return NextResponse.json(
      { ok: false, error: "Webhook URL not configured" },
      { status: 500 }
    );
  }

  try {
    const payload = await req.json();

    const gasRes = await fetch(GAS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const gasText = await gasRes.text();

    // GAS書き込み成功後、ログキャッシュを無効化
    // 次回のGET時にGASから最新データを再取得させる
    if (payload.type === "assessment") {
      invalidateAssessmentLogsCache();
    } else {
      // 受付ログ書き込み（デフォルト）→ 受付ログ + 判定ログ（booking_linked）両方を無効化
      invalidateBookingLogsCache();
      invalidateAssessmentLogsCache();
    }

    return NextResponse.json({ ok: true, gasResponse: gasText });
  } catch (err) {
    console.error("[notify] GAS送信エラー:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 502 }
    );
  }
}
