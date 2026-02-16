"use client";

import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import ConsentCheckbox from "@/app/components/ConsentCheckbox";
import { addBookingLog, sendBookingNotification } from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

const TIME_SLOT_OPTIONS = [
  { value: "", label: "指定なし" },
  { value: "午前（9:00-12:00）", label: "午前（9:00-12:00）" },
  { value: "午後（13:00-18:00）", label: "午後（13:00-18:00）" },
];

interface DateSlot {
  date: string;
  timeSlot: string;
}

function getMinDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

const CONTACT_KEY = "b2b_portal_contact";

export interface SavedContact {
  facilityName: string;
  contactName: string;
  phone: string;
  email: string;
}

export function getSavedContact(): SavedContact | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(CONTACT_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveContact(c: SavedContact): void {
  localStorage.setItem(CONTACT_KEY, JSON.stringify(c));
}

export default function BookingPage() {
  const [facilityName, setFacilityName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: "", timeSlot: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedConsent, setAgreedConsent] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = getSavedContact();
    if (saved) {
      setFacilityName(saved.facilityName);
      setContactName(saved.contactName);
      setPhone(saved.phone);
      setEmail(saved.email);
    }
  }, []);

  const updateDateSlot = (index: number, field: keyof DateSlot, value: string) => {
    setDateSlots((prev) =>
      prev.map((ds, i) => (i === index ? { ...ds, [field]: value } : ds))
    );
  };

  const addDateSlot = () => {
    if (dateSlots.length < 3) {
      setDateSlots((prev) => [...prev, { date: "", timeSlot: "" }]);
    }
  };

  const removeDateSlot = (index: number) => {
    if (dateSlots.length > 1) {
      setDateSlots((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const isFormComplete =
    facilityName && contactName && phone && dateSlots[0].date;
  const isFormValid = isFormComplete && agreedTerms && agreedConsent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    trackEvent("booking_submit", "submit_booking", dateSlots[0].date);

    const allDates = dateSlots
      .filter((ds) => ds.date)
      .map((ds) => `${ds.date}${ds.timeSlot ? ` ${ds.timeSlot}` : ""}`)
      .join(" / ");

    const agreedAt = new Date().toISOString();

    addBookingLog({
      facilityName,
      contactName,
      phone,
      email,
      preferredDate: dateSlots[0].date,
      preferredTime: dateSlots[0].timeSlot || "指定なし",
      notes: dateSlots.length > 1 ? `希望日程: ${allDates}\n${notes}` : notes,
      agreed_terms: true,
      agreed_consent: true,
      agreed_at: agreedAt,
    });

    const isRepeater = !!getSavedContact();

    // GASへ通知送信（非同期・失敗しても受付は完了扱い）
    sendBookingNotification({
      facilityName,
      contactName,
      phone,
      email,
      preferredDate: dateSlots[0].date,
      preferredTime: dateSlots[0].timeSlot || "指定なし",
      notes,
      allDateSlots: dateSlots.filter((ds) => ds.date),
      isRepeater,
    }).catch((err) => console.error("[notify] 送信失敗:", err));

    saveContact({ facilityName, contactName, phone, email });

    setTimeout(() => {
      setIsSubmitted(true);
      setIsSubmitting(false);
    }, 800);
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8">
          <div className="animate-fade-in w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center sm:p-8">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
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
            </div>
            <h2 className="mb-2 text-xl font-bold text-emerald-800">
              面談の受付を完了しました
            </h2>
            <p className="mb-4 text-sm text-emerald-600">
              現在は「仮受付」の状態です。担当の生田、または看護師より、本日または翌営業日中に、メールまたはお電話にて日程確定のご連絡を差し上げます。今しばらくお待ちください。
            </p>
            <div className="mb-6 rounded-lg bg-white p-4 text-left text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-muted">施設名</dt>
                  <dd className="font-medium">{facilityName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">ご担当者</dt>
                  <dd className="font-medium">{contactName}</dd>
                </div>
                {dateSlots.filter((ds) => ds.date).map((ds, i) => (
                  <div key={i} className="flex justify-between">
                    <dt className="text-muted">
                      {dateSlots.filter((d) => d.date).length > 1
                        ? `第${i + 1}希望`
                        : "面談日時"}
                    </dt>
                    <dd className="font-medium">
                      {ds.date} {ds.timeSlot || "指定なし"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <a
              href="/"
              className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark"
            >
              トップに戻る
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">面談申込</h1>
          <p className="text-sm text-muted">
            担当：生田、看護師 ｜ ご都合の良い日時をお選びください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-base font-bold text-slate-800">
              ご連絡先
            </h2>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                病院・施設名 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="例：〇〇総合病院"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                ご担当者名 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="例：山田 太郎"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  電話番号 <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03-XXXX-XXXX"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@hospital.jp"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Date & Time Preferences (max 3) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-base font-bold text-slate-800">
              面談希望日（最大3つ）
            </h2>

            <div className="space-y-3">
              {dateSlots.map((ds, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-xs">
                      {dateSlots.length > 1 ? `第${i + 1}希望` : "希望日"}{" "}
                      {i === 0 && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type="date"
                      value={ds.date}
                      min={getMinDate()}
                      max={getMaxDate()}
                      onChange={(e) => {
                        updateDateSlot(i, "date", e.target.value);
                        trackEvent("booking_start", "select_date", e.target.value);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
                    />
                  </div>
                  <div className="flex flex-1 items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-xs">
                      時間帯
                    </label>
                    <select
                      value={ds.timeSlot}
                      onChange={(e) => updateDateSlot(i, "timeSlot", e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
                    >
                      {TIME_SLOT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {dateSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDateSlot(i)}
                      className="mb-0.5 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500"
                      aria-label="削除"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  </div>
                </div>
              ))}
            </div>

            {dateSlots.length < 3 && (
              <button
                type="button"
                onClick={addDateSlot}
                className="mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 active:bg-primary/10"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                候補日を追加
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              備考・ご要望
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="ご質問やご要望がございましたらご記入ください"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
            />
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
                送信中...
              </span>
            ) : (
              "上記日程で面談を申し込む"
            )}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
