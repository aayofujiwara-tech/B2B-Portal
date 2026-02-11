"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import {
  runAssessment,
  addAssessmentLog,
  consumeSlot,
  type AssessmentResult,
} from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

function ResultContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const processedRef = useRef(false);

  const disease = searchParams.get("disease") || "";
  const adl = searchParams.get("adl") || "";
  const gender = searchParams.get("gender") || "";
  const budget = searchParams.get("budget") || "";
  const timing = searchParams.get("timing") || "";

  useEffect(() => {
    if (!disease) return;
    if (processedRef.current) return;
    processedRef.current = true;

    const assessmentResult = runAssessment({
      disease,
      adl,
      gender,
      budget,
      timing,
    });

    addAssessmentLog({
      disease,
      adl,
      gender,
      budget,
      timing,
      result: assessmentResult.status,
      reason: assessmentResult.reasons.join("; "),
      triggerFlags: assessmentResult.triggerFlags,
    });

    if (assessmentResult.status === "acceptable") {
      consumeSlot();
    }

    setResult(assessmentResult);
    trackEvent("result_view", "view_result", assessmentResult.status);

    const timer = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(timer);
  }, [disease, adl, gender, budget, timing]);

  if (!disease) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-muted">判定データがありません</p>
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          判定ページに戻る
        </Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center py-20">
        <svg
          className="mb-4 h-10 w-10 animate-spin text-primary"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-muted">判定中...</p>
      </div>
    );
  }

  const isAcceptable = result.status === "acceptable";

  return (
    <div
      className={`transition-all duration-500 ${showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      {/* Result Card */}
      <div
        className={`mb-6 rounded-xl border-2 p-6 text-center ${
          isAcceptable
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div
          className={`mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
            isAcceptable ? "bg-emerald-100" : "bg-amber-100"
          }`}
        >
          {isAcceptable ? (
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="h-8 w-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          )}
        </div>
        <h2
          className={`mb-1 text-xl font-bold ${isAcceptable ? "text-emerald-800" : "text-amber-800"}`}
        >
          {result.message}
        </h2>
        <p
          className={`text-sm ${isAcceptable ? "text-emerald-600" : "text-amber-600"}`}
        >
          {isAcceptable
            ? "条件に概ね合致しています。スムーズな入居に向けて、担当：生田との最終確認面談を優先的に予約してください。"
            : "詳細な調整が可能です。お電話または面談にて、最適な受入プランをご提案します。予約枠を確保してください。"}
        </p>
      </div>

      {/* 面談必須の注意書き */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-xs text-blue-800">
          ※ ご入居には担当：生田との面談（対面/オンライン）が必要です。面談では居室の詳細やケア体制をご確認いただけます。
        </p>
      </div>

      {/* Details */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-800">判定詳細</h3>
        <ul className="space-y-2">
          {result.reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-0.5 text-primary">&#x2022;</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Input Summary */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-800">入力内容</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">疾患</dt>
          <dd className="text-slate-700">{disease}</dd>
          <dt className="text-muted">ADL</dt>
          <dd className="text-slate-700">{adl}</dd>
          <dt className="text-muted">性別</dt>
          <dd className="text-slate-700">{gender}</dd>
          <dt className="text-muted">予算</dt>
          <dd className="text-slate-700">{budget}</dd>
          <dt className="text-muted">希望時期</dt>
          <dd className="text-slate-700">{timing}</dd>
        </dl>
      </div>

      {/* PDF Download */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-800">
          施設パンフレット
        </h3>
        <button
          onClick={() => {
            trackEvent("pdf_download", "click_download", "facility_pamphlet");
            alert(
              "※ プロトタイプのため、PDFダウンロードは模擬動作です。\n本番環境では実際のパンフレットPDFがダウンロードされます。"
            );
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 py-3 text-sm font-medium text-primary transition hover:bg-primary/10"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          施設パンフレットをダウンロード（PDF）
        </button>
      </div>

      {/* CTA */}
      {isAcceptable ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/booking"
            onClick={() =>
              trackEvent("booking_start", "click_booking_from_result")
            }
            className="flex flex-1 items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-dark active:scale-[0.98]"
          >
            スピード面談を予約する
          </Link>
          <Link
            href="/"
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            別の条件で再判定
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <a
            href="tel:03XXXXXXXX"
            onClick={() =>
              trackEvent("consultation_call", "click_phone_from_result")
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-amber-700 active:scale-[0.98]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            生田に今すぐ電話する
          </a>
          <Link
            href="/booking"
            onClick={() =>
              trackEvent("booking_start", "click_booking_from_consultation")
            }
            className="flex flex-1 items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-dark active:scale-[0.98]"
          >
            面談予約枠を確保する
          </Link>
          <Link
            href="/"
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-300 py-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            別の条件で再判定
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ResultPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Suspense
          fallback={
            <div className="flex flex-col items-center py-20">
              <svg
                className="mb-4 h-10 w-10 animate-spin text-primary"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-muted">読み込み中...</p>
            </div>
          }
        >
          <ResultContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
