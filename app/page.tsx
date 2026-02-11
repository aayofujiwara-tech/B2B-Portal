"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import SlotProgressBar from "@/app/components/SlotProgressBar";
import { trackEvent } from "@/app/lib/analytics";

const DISEASE_OPTIONS = [
  "脳血管疾患（脳梗塞・脳出血）",
  "認知症",
  "骨折・整形外科疾患",
  "心疾患",
  "呼吸器疾患",
  "がん（緩和ケア含む）",
  "神経難病（パーキンソン等）",
  "人工呼吸器",
  "透析",
  "その他",
];

const ADL_OPTIONS = ["自立", "一部介助", "半介助", "全介助"];
const GENDER_OPTIONS = ["男性", "女性"];
const BUDGET_OPTIONS = ["〜8万円", "8〜12万円", "12〜15万円", "15万円以上"];
const TIMING_OPTIONS = [
  "即日〜3日以内",
  "1週間以内",
  "2週間以内",
  "1ヶ月以内",
  "未定",
];

export default function TopPage() {
  const router = useRouter();
  const [disease, setDisease] = useState("");
  const [adl, setAdl] = useState("");
  const [gender, setGender] = useState("");
  const [budget, setBudget] = useState("");
  const [timing, setTiming] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = disease && adl && gender && budget && timing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    trackEvent("assessment_submit", "submit_form", disease);

    const params = new URLSearchParams({
      disease,
      adl,
      gender,
      budget,
      timing,
    });

    setTimeout(() => {
      router.push(`/result?${params.toString()}`);
    }, 600);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">
            受入可否を即時判定
          </h1>
          <p className="text-sm text-muted">
            24時間対応 ・ MSW様専用ポータル
          </p>
        </div>

        {/* Slot Progress */}
        <div className="mb-8">
          <SlotProgressBar />
        </div>

        {/* Assessment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-slate-800">
              簡易判定フォーム
            </h2>

            {/* Disease */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                主な疾患・状態
              </label>
              <select
                value={disease}
                onChange={(e) => {
                  setDisease(e.target.value);
                  trackEvent("assessment_start", "select_disease", e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">選択してください</option>
                {DISEASE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* ADL */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ADL（日常生活動作）
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ADL_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setAdl(option);
                      trackEvent("assessment_start", "select_adl", option);
                    }}
                    className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                      adl === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                性別
              </label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setGender(option);
                      trackEvent("assessment_start", "select_gender", option);
                    }}
                    className={`flex-1 rounded-lg border px-3 py-3 text-sm font-medium transition ${
                      gender === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ご予算（月額目安）
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BUDGET_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setBudget(option);
                      trackEvent("assessment_start", "select_budget", option);
                    }}
                    className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                      budget === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ご希望の入居時期
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIMING_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setTiming(option);
                      trackEvent("assessment_start", "select_timing", option);
                    }}
                    className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                      timing === option
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full rounded-xl py-4 text-base font-bold text-white shadow-lg transition ${
              isFormValid && !isSubmitting
                ? "bg-primary hover:bg-primary-dark active:scale-[0.98]"
                : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin"
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
                判定中...
              </span>
            ) : (
              "10秒で判定する"
            )}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
