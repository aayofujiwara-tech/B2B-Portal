"use client";

import { useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { addBookingLog } from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

// Mock calendar data for 生田 (Ikuta)
const AVAILABLE_DATES = (() => {
  const dates: { date: string; label: string; slots: string[] }[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0) continue; // Skip Sunday
    const dateStr = d.toISOString().split("T")[0];
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    const label = `${d.getMonth() + 1}/${d.getDate()}（${dayNames[dayOfWeek]}）`;
    const slots =
      dayOfWeek === 6
        ? ["10:00", "11:00"]
        : ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
    dates.push({ date: dateStr, label, slots });
  }
  return dates;
})();

export default function BookingPage() {
  const [facilityName, setFacilityName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDateObj = AVAILABLE_DATES.find((d) => d.date === selectedDate);

  const isFormValid =
    facilityName && contactName && phone && selectedDate && selectedTime;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    trackEvent("booking_submit", "submit_booking", selectedDate);

    addBookingLog({
      facilityName,
      contactName,
      phone,
      email,
      preferredDate: selectedDate,
      preferredTime: selectedTime,
      notes,
    });

    setTimeout(() => {
      setIsSubmitted(true);
      setIsSubmitting(false);
    }, 800);
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="animate-fade-in w-full rounded-xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center">
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
              ご予約を承りました
            </h2>
            <p className="mb-4 text-sm text-emerald-600">
              担当の生田より確認のご連絡をいたします
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
                <div className="flex justify-between">
                  <dt className="text-muted">内覧日時</dt>
                  <dd className="font-medium">
                    {selectedDateObj?.label} {selectedTime}
                  </dd>
                </div>
              </dl>
            </div>
            <a
              href="/"
              className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark"
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">内覧予約</h1>
          <p className="text-sm text-muted">
            担当：生田 ｜ ご都合の良い日時をお選びください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Calendar Selection */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-800">
              内覧希望日
            </h2>

            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {AVAILABLE_DATES.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d.date);
                    setSelectedTime("");
                    trackEvent("booking_start", "select_date", d.label);
                  }}
                  className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
                    selectedDate === d.date
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {selectedDateObj && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  時間帯を選択
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {selectedDateObj.slots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setSelectedTime(time);
                        trackEvent("booking_start", "select_time", time);
                      }}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                        selectedTime === time
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              備考・ご要望
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="ご質問やご要望がございましたらご記入ください"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
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
                送信中...
              </span>
            ) : (
              "内覧予約を確定する"
            )}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
