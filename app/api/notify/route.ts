import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ ok: true, gasResponse: gasText });
  } catch (err) {
    console.error("[notify] GAS送信エラー:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 502 }
    );
  }
}
