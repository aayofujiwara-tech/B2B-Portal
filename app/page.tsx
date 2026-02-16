"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import ConsentCheckbox from "@/app/components/ConsentCheckbox";
import SlotProgressBar from "@/app/components/SlotProgressBar";
import { trackEvent } from "@/app/lib/analytics";
import { getSlotConfig, FACILITY_IDS, type FacilityId } from "@/app/lib/slotStore";
import { type SavedContact, getSavedContact } from "@/app/booking/page";

const DISEASE_OPTIONS = [
  "脳血管疾患（脳梗塞・脳出血）",
  "認知症",
  "骨折・整形外科疾患",
  "心疾患",
  "呼吸器疾患",
  "がん（緩和ケア含む）",
  "神経難病（パーキンソン等）",
  "精神疾患（統合失調症、うつ、双極性障害など）",
  "人工呼吸器",
  "透析",
  "その他",
];

const MENTAL_GRADE_OPTIONS = ["1級", "2級", "3級"];

const ADL_OPTIONS = ["自立", "見守り", "一部介助", "全介助"];
const DEMENTIA_LEVEL_OPTIONS = [
  "軽度（見守り程度）",
  "中等度（日常的な支援が必要）",
  "重度（徘徊・BPSD顕著）",
];
const GENDER_OPTIONS = ["男性", "女性"];
const BUDGET_OPTIONS = ["〜8万円", "8〜12万円", "12〜15万円", "15万円以上"];
const TIMING_OPTIONS = [
  "即日〜3日以内",
  "1週間以内",
  "2週間以内",
  "1ヶ月以内",
  "未定",
];

const FACILITY_OPTIONS = [
  { id: "tsukamoto", label: "塚本" },
  { id: "utajima", label: "歌島" },
  { id: "toyoshin", label: "豊新" },
  { id: "any", label: "どこでも可" },
];

const FACILITY_INFO: Record<string, {
  name: string;
  access: string;
  structure: string;
  rent: string;
  features: string[];
  caution?: string;
  pdf: string;
}> = {
  tsukamoto: {
    name: "ええすまい塚本",
    access: "JR塚本駅 徒歩7分",
    structure: "鉄骨7階建",
    rent: "賃料5.0万円〜",
    features: ["保証人不要", "初期費用分割可能", "生活保護受給者対応"],
    pdf: "/pdf/flyer-tsukamoto.pdf",
  },
  utajima: {
    name: "ええすまい歌島",
    access: "JR塚本駅 徒歩8分",
    structure: "鉄骨6階建",
    rent: "賃料5.0万円〜",
    features: ["保証人不要", "初期費用分割可能", "生活保護受給者対応"],
    pdf: "/pdf/flyer-utajima.pdf",
  },
  toyoshin: {
    name: "ええすまい豊新",
    access: "阪急上新庄駅 徒歩10分",
    structure: "鉄骨10階建",
    rent: "賃料5.0万円〜",
    features: ["保証人不要", "初期費用分割可能"],
    caution: "※現在、豊新では生活保護の受入を停止しております",
    pdf: "/pdf/flyer-houshin.pdf",
  },
};

export default function TopPage() {
  const router = useRouter();
  const [disease, setDisease] = useState("");
  const [diseaseOther, setDiseaseOther] = useState("");
  const [adl, setAdl] = useState("");
  const [dementiaLevel, setDementiaLevel] = useState("");
  const [medicalDevice, setMedicalDevice] = useState(false);
  const [mentalGrade, setMentalGrade] = useState("");
  const [selfHarm, setSelfHarm] = useState(false);
  const [otherHarm, setOtherHarm] = useState(false);
  const [gender, setGender] = useState("");
  const [budget, setBudget] = useState("");
  const [timing, setTiming] = useState("");
  const [facility, setFacility] = useState("");
  const [welfare, setWelfare] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedConsent, setAgreedConsent] = useState(false);
  const [savedContact, setSavedContact] = useState<SavedContact | null>(null);
  const [facilityRemaining, setFacilityRemaining] = useState<number | null>(null);

  useEffect(() => {
    setSavedContact(getSavedContact());
  }, []);

  useEffect(() => {
    if (facility && facility !== "any" && FACILITY_IDS.includes(facility as FacilityId)) {
      const sc = getSlotConfig(facility as FacilityId);
      setFacilityRemaining(Math.max(0, sc.totalSlots - sc.usedSlots));
    } else {
      setFacilityRemaining(null);
    }
  }, [facility]);

  const isDiseaseValid = disease && (disease !== "その他" || diseaseOther.trim());
  const isFormComplete = isDiseaseValid && adl && gender && budget && timing && facility;
  const isFormValid = isFormComplete && agreedTerms && agreedConsent;

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
      facility,
      welfare: welfare ? "1" : "0",
      medicalDevice: medicalDevice ? "1" : "0",
      ...(dementiaLevel ? { dementiaLevel } : {}),
      ...(diseaseOther.trim() ? { diseaseOther: diseaseOther.trim() } : {}),
      ...(mentalGrade ? { mentalGrade } : {}),
      ...(selfHarm ? { selfHarm: "1" } : {}),
      ...(otherHarm ? { otherHarm: "1" } : {}),
      agreed_terms: "1",
      agreed_consent: "1",
      agreed_at: new Date().toISOString(),
    });

    setTimeout(() => {
      router.push(`/result?${params.toString()}`);
    }, 600);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">
            入居可能性を事前確認
          </h1>
          <p className="text-sm text-muted">
            24時間対応 ・ 紹介業者、MSW向けポータル
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ※ ご入居には担当：生田、<strong>看護師</strong>との面談が必要です
          </p>
        </div>

        {/* Slot Progress */}
        <div className="mb-8">
          <SlotProgressBar facilityId={facility || undefined} />
        </div>

        {/* Repeater Shortcut */}
        {savedContact && (
          <div className="mb-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-5 shadow-sm">
            <p className="mb-1 text-sm font-bold text-slate-800">
              {savedContact.contactName}様（{savedContact.facilityName}）、お疲れ様です
            </p>
            <p className="mb-3 text-xs text-muted">
              前回の情報でスピード受付できます。入力ステップをスキップして直接面談申込へ進めます。
            </p>
            <Link
              href="/booking"
              onClick={() => trackEvent("booking_start", "click_repeater_shortcut")}
              className="flex items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary-dark active:scale-[0.98]"
            >
              スピード面談申込へ進む
            </Link>
          </div>
        )}

        {/* Facility Selector (top-level, before form) */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-bold text-slate-800">
            拠点を選択
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-2">
            {FACILITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setFacility(opt.id);
                  trackEvent("assessment_start", "select_facility", opt.id);
                }}
                className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                  facility === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Facility Info Card (appears when a specific facility is selected) */}
        {facility && facility !== "any" && FACILITY_INFO[facility] && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-white p-4 shadow-sm sm:p-5">
            <p className="mb-2.5 text-base font-bold text-slate-800">
              {FACILITY_INFO[facility].name}
            </p>
            {facilityRemaining === 0 && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2">
                <p className="text-sm font-bold text-red-600">
                  空室状況：満室
                </p>
                <p className="mt-0.5 text-xs leading-tight text-red-500">
                  ※空き予定の確認やキャンセル待ちは可能です
                </p>
              </div>
            )}
            <div className="mb-3 grid grid-cols-1 gap-1.5 text-sm text-slate-600 sm:grid-cols-3 sm:text-xs">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {FACILITY_INFO[facility].access}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                {FACILITY_INFO[facility].structure}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {FACILITY_INFO[facility].rent}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {FACILITY_INFO[facility].features.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {f}
                </span>
              ))}
            </div>
            {FACILITY_INFO[facility].caution && (
              <p className="mb-3 text-xs font-medium text-amber-700">
                {FACILITY_INFO[facility].caution}
              </p>
            )}
            <a
              href={FACILITY_INFO[facility].pdf}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-amber-600 active:scale-[0.98] sm:inline-flex sm:w-auto"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ご家族説明用のチラシをダウンロード(PDF)
            </a>
          </div>
        )}

        {/* Assessment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-5 text-base font-bold text-slate-800">
              入居判定フォーム
            </h2>

            {/* Disease */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                主な疾患・状態
              </label>
              <select
                value={disease}
                onChange={(e) => {
                  const v = e.target.value;
                  setDisease(v);
                  if (v !== "認知症") setDementiaLevel("");
                  if (!v.includes("精神疾患")) {
                    setMentalGrade("");
                    setSelfHarm(false);
                    setOtherHarm(false);
                  }
                  if (v !== "その他") setDiseaseOther("");
                  trackEvent("assessment_start", "select_disease", v);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
              >
                <option value="">選択してください</option>
                {DISEASE_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Dementia Severity (conditional) */}
            {disease === "認知症" && (
              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  認知症の程度
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-2">
                  {DEMENTIA_LEVEL_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setDementiaLevel(option);
                        trackEvent("assessment_start", "select_dementia_level", option);
                      }}
                      className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                        dementiaLevel === option
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mental illness sub-items (conditional) */}
            {disease.includes("精神疾患") && (
              <div className="mb-5 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    障害等級（精神障害者保健福祉手帳）
                  </label>
                  <div className="flex gap-2.5 sm:gap-2">
                    {MENTAL_GRADE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setMentalGrade(option);
                          trackEvent("assessment_start", "select_mental_grade", option);
                        }}
                        className={`flex-1 rounded-lg border px-3 py-3 text-sm font-medium transition ${
                          mentalGrade === option
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    自傷・他害の有無
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300">
                      <input
                        type="checkbox"
                        checked={selfHarm}
                        onChange={(e) => setSelfHarm(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-primary accent-primary sm:h-4 sm:w-4"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        自傷あり
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300">
                      <input
                        type="checkbox"
                        checked={otherHarm}
                        onChange={(e) => setOtherHarm(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-primary accent-primary sm:h-4 sm:w-4"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        他害あり
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Other disease free text (conditional) */}
            {disease === "その他" && (
              <div className="mb-5">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  疾患・状態の詳細 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={diseaseOther}
                  onChange={(e) => setDiseaseOther(e.target.value)}
                  placeholder="具体的な疾患名や状態を入力してください"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
                />
                {disease === "その他" && !diseaseOther.trim() && (
                  <p className="mt-1.5 text-xs text-danger">
                    「その他」を選択した場合は詳細の入力が必要です
                  </p>
                )}
              </div>
            )}

            {/* Medical device checkbox */}
            <div className="mb-5">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 transition hover:border-slate-300">
                <input
                  type="checkbox"
                  checked={medicalDevice}
                  onChange={(e) => setMedicalDevice(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-primary accent-primary sm:h-4 sm:w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  医療機器・医療処置あり
                </span>
              </label>
            </div>

            {/* ADL */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ADL（日常生活動作）
              </label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-2">
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

            {/* Dementia safety warning */}
            {disease === "認知症" &&
              dementiaLevel?.includes("重度") &&
              (adl === "自立" || adl === "見守り" || adl === "一部介助") && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium leading-relaxed text-red-700">
                  認知症重度で当該介助レベルの場合、外出時の交通事故等のリスクがあります。十分にご確認ください。
                </p>
              </div>
            )}

            {/* Gender */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                性別
              </label>
              <div className="flex gap-2.5 sm:gap-2">
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
              <div className="grid grid-cols-2 gap-2.5 sm:gap-2">
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
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-2">
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

            {/* Welfare */}
            <div className="mb-5">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 transition hover:border-slate-300">
                <input
                  type="checkbox"
                  checked={welfare}
                  onChange={(e) => setWelfare(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-primary accent-primary sm:h-4 sm:w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  生活保護受給あり
                </span>
              </label>
              {welfare && facility === "toyoshin" && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  豊新は現在生活保護の受入を停止しております。塚本・歌島では受入可能です。
                </p>
              )}
            </div>
          </div>

          {/* Consent Checkboxes */}
          <ConsentCheckbox
            agreedTerms={agreedTerms}
            agreedConsent={agreedConsent}
            onChangeTerms={setAgreedTerms}
            onChangeConsent={setAgreedConsent}
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            aria-disabled={!isFormValid || isSubmitting}
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
              "入居可能性を確認する"
            )}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
