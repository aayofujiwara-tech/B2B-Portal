"use client";

import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import {
  getSlotConfig,
  reloadSlots,
  getAssessmentLogs,
  getBookingLogs,
  type SlotConfig,
  type AssessmentLog,
  type BookingLog,
} from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

const ADMIN_PASSWORD = "ikuta2024";

function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem("b2b_admin_auth", "1");
      onAuth();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-center text-lg font-bold text-slate-800">管理画面ログイン</h1>
          <form onSubmit={handleSubmit}>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">パスワード</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
            {error && <p className="mb-3 text-xs text-red-600">パスワードが正しくありません</p>}
            <button type="submit" className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary-dark">
              ログイン
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [slotConfig, setSlotConfig] = useState<SlotConfig | null>(null);
  const [assessmentLogs, setAssessmentLogs] = useState<AssessmentLog[]>([]);
  const [bookingLogs, setBookingLogs] = useState<BookingLog[]>([]);
  const [newTotal, setNewTotal] = useState(5);
  const [activeTab, setActiveTab] = useState<
    "slots" | "assessments" | "bookings"
  >("slots");

  const loadData = () => {
    setSlotConfig(getSlotConfig());
    setAssessmentLogs(getAssessmentLogs());
    setBookingLogs(getBookingLogs());
  };

  useEffect(() => {
    if (sessionStorage.getItem("b2b_admin_auth") === "1") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  if (!authed) {
    return <AdminAuth onAuth={() => setAuthed(true)} />;
  }

  const handleReload = () => {
    reloadSlots(newTotal);
    trackEvent("admin_action", "reload_slots", `total=${newTotal}`);
    loadData();
  };

  if (!slotConfig) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted">読み込み中...</p>
        </main>
        <Footer />
      </div>
    );
  }

  const remaining = Math.max(0, slotConfig.totalSlots - slotConfig.usedSlots);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-1 text-2xl font-bold text-slate-800">管理画面</h1>
          <p className="text-sm text-muted">優先面談枠の管理と判定ログの確認</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { key: "slots" as const, label: "面談枠管理" },
            { key: "assessments" as const, label: `判定ログ（${assessmentLogs.length}）` },
            { key: "bookings" as const, label: `予約ログ（${bookingLogs.length}）` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-muted hover:text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Slot Management */}
        {activeTab === "slots" && (
          <div className="space-y-6 animate-fade-in">
            {/* Current Status */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-800">
                現在の枠状況
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {slotConfig.totalSlots}
                  </p>
                  <p className="text-xs text-muted">総枠数</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-800">
                    {slotConfig.usedSlots}
                  </p>
                  <p className="text-xs text-muted">使用済み</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${remaining > 0 ? "text-emerald-600" : "text-danger"}`}
                  >
                    {remaining}
                  </p>
                  <p className="text-xs text-muted">残り</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p
                    className={`text-sm font-bold ${
                      slotConfig.status === "available"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {slotConfig.status === "available"
                      ? "受入可能"
                      : "調整中"}
                  </p>
                  <p className="text-xs text-muted">ステータス</p>
                </div>
              </div>

              {/* Visual Progress */}
              <div className="mt-4 flex gap-1.5">
                {Array.from({ length: slotConfig.totalSlots }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-6 flex-1 rounded-sm ${
                      i < slotConfig.usedSlots
                        ? "bg-primary"
                        : "border border-slate-200 bg-slate-50"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                最終リロード日: {slotConfig.lastReloadDate}
              </p>
            </div>

            {/* Reload Control */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-800">
                枠のリロード（補充）
              </h2>
              <p className="mb-4 text-sm text-muted">
                新しい受入枠数を設定して、枠をリセットします。使用済み枠は0にリセットされます。
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    新しい総枠数
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newTotal}
                    onChange={(e) =>
                      setNewTotal(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  onClick={handleReload}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark active:scale-[0.98]"
                >
                  枠をリロード
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Logs */}
        {activeTab === "assessments" && (
          <div className="animate-fade-in">
            {assessmentLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-muted">判定ログはまだありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assessmentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          log.result === "acceptable"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {log.result === "acceptable" ? "受入可能" : "要相談"}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(log.timestamp).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">
                      <div>
                        <span className="text-muted">疾患:</span>{" "}
                        <span className="font-medium">{log.disease}</span>
                      </div>
                      <div>
                        <span className="text-muted">ADL:</span>{" "}
                        <span className="font-medium">{log.adl}</span>
                      </div>
                      <div>
                        <span className="text-muted">性別:</span>{" "}
                        <span className="font-medium">{log.gender}</span>
                      </div>
                      <div>
                        <span className="text-muted">予算:</span>{" "}
                        <span className="font-medium">{log.budget}</span>
                      </div>
                      <div>
                        <span className="text-muted">時期:</span>{" "}
                        <span className="font-medium">{log.timing}</span>
                      </div>
                    </div>
                    {log.reason && (
                      <p className="mt-2 text-xs text-muted">{log.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking Logs */}
        {activeTab === "bookings" && (
          <div className="animate-fade-in">
            {bookingLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-muted">予約ログはまだありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookingLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">
                        {log.facilityName}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(log.timestamp).toLocaleString("ja-JP")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-muted">担当者:</span>{" "}
                        <span className="font-medium">{log.contactName}</span>
                      </div>
                      <div>
                        <span className="text-muted">電話:</span>{" "}
                        <span className="font-medium">{log.phone}</span>
                      </div>
                      <div>
                        <span className="text-muted">希望日:</span>{" "}
                        <span className="font-medium">
                          {log.preferredDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">時間:</span>{" "}
                        <span className="font-medium">
                          {log.preferredTime}
                        </span>
                      </div>
                    </div>
                    {log.notes && (
                      <p className="mt-2 text-xs text-muted">
                        備考: {log.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
