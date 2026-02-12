"use client";

import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import {
  getSlotConfig,
  reloadSlots,
  getAssessmentLogs,
  getBookingLogs,
  getNotificationEmails,
  saveNotificationEmails,
  FACILITY_IDS,
  FACILITY_LABELS,
  type SlotConfig,
  type AssessmentLog,
  type BookingLog,
  type FacilityId,
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
  const [facilitySlots, setFacilitySlots] = useState<
    Record<FacilityId, SlotConfig> | null
  >(null);
  const [newTotals, setNewTotals] = useState<Record<FacilityId, number>>({
    tsukamoto: 5,
    toyoshin: 5,
    utajima: 5,
  });
  const [assessmentLogs, setAssessmentLogs] = useState<AssessmentLog[]>([]);
  const [bookingLogs, setBookingLogs] = useState<BookingLog[]>([]);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "slots" | "assessments" | "bookings" | "notifications"
  >("slots");

  const loadData = () => {
    const slots = {} as Record<FacilityId, SlotConfig>;
    for (const id of FACILITY_IDS) {
      slots[id] = getSlotConfig(id);
    }
    setFacilitySlots(slots);
    setAssessmentLogs(getAssessmentLogs());
    setBookingLogs(getBookingLogs());
    setNotifyEmails(getNotificationEmails());
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

  const handleReload = (facilityId: FacilityId) => {
    reloadSlots(newTotals[facilityId], facilityId);
    trackEvent("admin_action", "reload_slots", `${facilityId}=${newTotals[facilityId]}`);
    loadData();
  };

  if (!facilitySlots) {
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-1 text-2xl font-bold text-slate-800">管理画面</h1>
          <p className="text-sm text-muted">優先面談枠の管理と判定ログの確認</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:flex">
          {[
            { key: "slots" as const, label: "面談枠管理" },
            { key: "assessments" as const, label: `判定ログ（${assessmentLogs.length}）` },
            { key: "bookings" as const, label: `受付ログ（${bookingLogs.length}）` },
            { key: "notifications" as const, label: "通知設定" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md py-2.5 text-xs font-medium transition sm:py-2 sm:text-sm ${
                activeTab === tab.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-muted hover:text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Slot Management — per-facility */}
        {activeTab === "slots" && (
          <div className="space-y-6 animate-fade-in">
            {FACILITY_IDS.map((id) => {
              const sc = facilitySlots[id];
              const rem = Math.max(0, sc.totalSlots - sc.usedSlots);
              return (
                <div
                  key={id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h2 className="mb-4 text-base font-bold text-slate-800">
                    {FACILITY_LABELS[id]}
                  </h2>

                  {/* Stats */}
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xl font-bold text-primary">{sc.totalSlots}</p>
                      <p className="text-xs text-muted">総枠</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className="text-xl font-bold text-slate-800">{sc.usedSlots}</p>
                      <p className="text-xs text-muted">使用済</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className={`text-xl font-bold ${rem > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {rem}
                      </p>
                      <p className="text-xs text-muted">残り</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-center">
                      <p className={`text-sm font-bold ${sc.status === "available" ? "text-emerald-600" : "text-amber-600"}`}>
                        {sc.status === "available" ? "受入可能" : "調整中"}
                      </p>
                      <p className="text-xs text-muted">状態</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2 flex gap-1">
                    {Array.from({ length: sc.totalSlots }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-5 flex-1 rounded-sm ${
                          i < sc.usedSlots
                            ? "bg-primary"
                            : "border border-slate-200 bg-slate-50"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mb-4 text-xs text-muted">
                    最終リロード: {sc.lastReloadDate}
                  </p>

                  {/* Reload */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        新しい総枠数
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={newTotals[id]}
                        onChange={(e) =>
                          setNewTotals((prev) => ({
                            ...prev,
                            [id]: Math.max(1, parseInt(e.target.value) || 1),
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2 sm:text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleReload(id)}
                      className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-dark active:scale-[0.98] sm:py-2"
                    >
                      リロード
                    </button>
                  </div>
                </div>
              );
            })}
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
                    <div className="grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-5 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
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
                      <p className="mt-2 text-sm text-muted sm:text-xs">{log.reason}</p>
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
                <p className="text-muted">受付ログはまだありません</p>
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
                    <div className="grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-4 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
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
                      <p className="mt-2 text-sm text-muted sm:text-xs">
                        備考: {log.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Notification Email Management */}
        {activeTab === "notifications" && (
          <div className="animate-fade-in">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-base font-bold text-slate-800">
                通知先メールアドレス設定
              </h2>
              <p className="mb-5 text-xs text-muted">
                面談受付時にここで登録されたアドレス全てへ通知メールが送信されます（GAS連携準備）
              </p>

              {/* Add email form */}
              <div className="mb-5 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailError(""); }}
                  placeholder="example@company.com"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const email = newEmail.trim();
                      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        setEmailError("有効なメールアドレスを入力してください");
                        return;
                      }
                      if (notifyEmails.includes(email)) {
                        setEmailError("このアドレスは既に登録済みです");
                        return;
                      }
                      const updated = [...notifyEmails, email];
                      saveNotificationEmails(updated);
                      setNotifyEmails(updated);
                      setNewEmail("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const email = newEmail.trim();
                    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                      setEmailError("有効なメールアドレスを入力してください");
                      return;
                    }
                    if (notifyEmails.includes(email)) {
                      setEmailError("このアドレスは既に登録済みです");
                      return;
                    }
                    const updated = [...notifyEmails, email];
                    saveNotificationEmails(updated);
                    setNotifyEmails(updated);
                    setNewEmail("");
                  }}
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-dark active:scale-[0.98] sm:py-2.5"
                >
                  追加
                </button>
              </div>
              {emailError && (
                <p className="mb-3 -mt-3 text-xs text-red-600">{emailError}</p>
              )}

              {/* Email list */}
              {notifyEmails.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-6 text-center">
                  <p className="text-sm text-muted">通知先が未登録です</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {notifyEmails.map((em, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm text-slate-700">{em}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = notifyEmails.filter((_, idx) => idx !== i);
                          saveNotificationEmails(updated);
                          setNotifyEmails(updated);
                        }}
                        className="flex h-[44px] w-[44px] items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        aria-label="削除"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted">
                登録数: {notifyEmails.length}件
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
