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
  toggleAssessmentHandled,
  toggleBookingHandled,
  deleteAssessmentLogs,
  deleteBookingLogs,
  deleteAssessmentLogsBefore,
  deleteBookingLogsBefore,
  FACILITY_IDS,
  FACILITY_LABELS,
  type SlotConfig,
  type AssessmentLog,
  type BookingLog,
  type FacilityId,
} from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

const ADMIN_PASSWORD = "ikuta2024";

function ConfirmModal({
  title,
  message,
  warning,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  warning?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className={`mb-2 text-base font-bold ${warning ? "text-red-700" : "text-slate-800"}`}>
          {title}
        </h3>
        <p className="mb-5 whitespace-pre-wrap text-sm text-slate-600">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-3 text-sm font-bold text-white transition active:scale-[0.98] ${
              warning
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary hover:bg-primary-dark"
            }`}
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}

const CLEANUP_PRESETS = [
  { label: "1ヶ月前以前", months: 1 },
  { label: "3ヶ月前以前", months: 3 },
  { label: "6ヶ月前以前", months: 6 },
] as const;

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
    tsukamoto: 0,
    utajima: 0,
    toyoshin: 0,
  });
  const [assessmentLogs, setAssessmentLogs] = useState<AssessmentLog[]>([]);
  const [bookingLogs, setBookingLogs] = useState<BookingLog[]>([]);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "slots" | "assessments" | "bookings" | "notifications"
  >("slots");
  const [toastMessage, setToastMessage] = useState("");
  const [selectedAssessments, setSelectedAssessments] = useState<Set<string>>(new Set());
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    warning?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [cleanupDate, setCleanupDate] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

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
    showToast(`${FACILITY_LABELS[facilityId]}の空室状況を更新しました`);
  };

  // --- Delete handlers ---
  const handleDeleteOneAssessment = (id: string) => {
    setConfirmAction({
      title: "ログの削除",
      message: "このログを削除してもよろしいですか？",
      onConfirm: () => {
        setAssessmentLogs(deleteAssessmentLogs([id]));
        setSelectedAssessments((prev) => { const next = new Set(prev); next.delete(id); return next; });
        setConfirmAction(null);
        showToast("ログを1件削除しました");
      },
    });
  };

  const handleDeleteOneBooking = (id: string) => {
    setConfirmAction({
      title: "ログの削除",
      message: "このログを削除してもよろしいですか？",
      onConfirm: () => {
        setBookingLogs(deleteBookingLogs([id]));
        setSelectedBookings((prev) => { const next = new Set(prev); next.delete(id); return next; });
        setConfirmAction(null);
        showToast("ログを1件削除しました");
      },
    });
  };

  const handleBulkDeleteAssessments = () => {
    if (selectedAssessments.size === 0) return;
    setConfirmAction({
      title: "一括削除",
      message: `選択した${selectedAssessments.size}件のログを削除します。よろしいですか？`,
      warning: true,
      onConfirm: () => {
        setAssessmentLogs(deleteAssessmentLogs([...selectedAssessments]));
        setSelectedAssessments(new Set());
        setConfirmAction(null);
        showToast(`${selectedAssessments.size}件のログを削除しました`);
      },
    });
  };

  const handleBulkDeleteBookings = () => {
    if (selectedBookings.size === 0) return;
    setConfirmAction({
      title: "一括削除",
      message: `選択した${selectedBookings.size}件のログを削除します。よろしいですか？`,
      warning: true,
      onConfirm: () => {
        setBookingLogs(deleteBookingLogs([...selectedBookings]));
        setSelectedBookings(new Set());
        setConfirmAction(null);
        showToast(`${selectedBookings.size}件のログを削除しました`);
      },
    });
  };

  const handleCsvBackup = () => {
    const BOM = "\uFEFF";
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    const assessmentHeader = [
      "種別", "ID", "タイムスタンプ", "判定結果", "疾患", "疾患詳細", "ADL",
      "認知症レベル", "医療機器", "障害等級", "自傷", "他害",
      "性別", "予算", "時期", "理由",
      "トリガーフラグ", "対応済", "対応日時",
    ];
    const bookingHeader = [
      "種別", "ID", "タイムスタンプ", "施設名", "担当者名", "電話番号",
      "メール", "希望日", "希望時間", "備考", "対応済", "対応日時",
    ];

    const esc = (v: string | undefined | boolean) => {
      if (v === undefined || v === null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const maxCols = Math.max(assessmentHeader.length, bookingHeader.length);
    const pad = (row: string[]) => {
      while (row.length < maxCols) row.push("");
      return row;
    };

    const rows: string[] = [];
    // Unified header
    const unifiedHeader = [
      "種別", "ID", "タイムスタンプ", "フィールド1", "フィールド2",
      "フィールド3", "フィールド4", "フィールド5", "フィールド6",
      "フィールド7", "フィールド8", "フィールド9", "対応済", "対応日時",
    ];

    // Assessment rows section
    rows.push(assessmentHeader.map(esc).join(","));
    for (const l of assessmentLogs) {
      rows.push(pad([
        "判定", l.id, l.timestamp,
        l.result === "acceptable" ? "受入可能" : l.result === "safety_risk" ? "要慎重検討" : "要相談",
        l.disease, l.diseaseOther || "", l.adl, l.dementiaLevel || "",
        l.medicalDevice ? "あり" : "", l.mentalGrade || "",
        l.selfHarm ? "あり" : "", l.otherHarm ? "あり" : "",
        l.gender, l.budget, l.timing,
        l.reason || "", (l.triggerFlags || []).join(";"),
        l.isHandled ? "済" : "未", l.handledAt || "",
      ].map(esc)).join(","));
    }

    rows.push(""); // blank separator

    // Booking rows section
    rows.push(bookingHeader.map(esc).join(","));
    for (const l of bookingLogs) {
      rows.push(pad([
        "受付", l.id, l.timestamp, l.facilityName, l.contactName, l.phone,
        l.email, l.preferredDate, l.preferredTime, l.notes,
        l.isHandled ? "済" : "未", l.handledAt || "",
      ].map(esc)).join(","));
    }

    const blob = new Blob([BOM + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ee-sumai-all-logs_${yyyymmdd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSVバックアップをダウンロードしました");
  };

  const handleCleanup = (cutoffISO: string, label: string) => {
    const aCount = assessmentLogs.filter((l) => l.timestamp < cutoffISO).length;
    const bCount = bookingLogs.filter((l) => l.timestamp < cutoffISO).length;
    const total = aCount + bCount;
    if (total === 0) {
      showToast("該当するログはありません");
      return;
    }
    setConfirmAction({
      title: "期間指定クリーンアップ",
      message: `${label}の全てのデータ（判定${aCount}件・受付${bCount}件、計${total}件）が消去されます。\nこの操作は取り消せません。本当によろしいですか？`,
      warning: true,
      onConfirm: () => {
        setAssessmentLogs(deleteAssessmentLogsBefore(cutoffISO));
        setBookingLogs(deleteBookingLogsBefore(cutoffISO));
        setSelectedAssessments(new Set());
        setSelectedBookings(new Set());
        setConfirmAction(null);
        showToast(`${total}件のログを削除しました`);
      },
    });
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
        {/* Confirm modal */}
        {confirmAction && (
          <ConfirmModal
            title={confirmAction.title}
            message={confirmAction.message}
            warning={confirmAction.warning}
            onConfirm={confirmAction.onConfirm}
            onCancel={() => setConfirmAction(null)}
          />
        )}

        {/* Toast notification */}
        {toastMessage && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-fade-in rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 shadow-lg">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {toastMessage}
            </p>
          </div>
        )}

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-800">管理画面</h1>
            <p className="text-sm text-muted">優先面談枠の管理と判定ログの確認</p>
          </div>
          <button
            type="button"
            onClick={handleCsvBackup}
            disabled={assessmentLogs.length === 0 && bookingLogs.length === 0}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSVバックアップ
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:flex">
          {[
            { key: "slots" as const, label: "面談枠管理", unhandled: 0 },
            { key: "assessments" as const, label: `判定ログ（${assessmentLogs.length}）`, unhandled: assessmentLogs.filter((l) => !l.isHandled).length },
            { key: "bookings" as const, label: `受付ログ（${bookingLogs.length}）`, unhandled: bookingLogs.filter((l) => !l.isHandled).length },
            { key: "notifications" as const, label: "通知設定", unhandled: 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 rounded-md py-2.5 text-xs font-medium transition sm:py-2 sm:text-sm ${
                activeTab === tab.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-muted hover:text-slate-600"
              }`}
            >
              {tab.label}
              {tab.unhandled > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {tab.unhandled}
                </span>
              )}
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
                        min={0}
                        max={20}
                        value={newTotals[id]}
                        onChange={(e) =>
                          setNewTotals((prev) => ({
                            ...prev,
                            [id]: Math.max(0, parseInt(e.target.value) || 0),
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
            {assessmentLogs.length > 0 && (
              <>
                {/* Stats + bulk toolbar */}
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">
                    未対応：<span className="font-bold text-red-600">{assessmentLogs.filter((l) => !l.isHandled).length}</span>件
                  </span>
                  <span className="text-sm text-muted">
                    ／ 全{assessmentLogs.length}件
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-primary"
                        checked={selectedAssessments.size === assessmentLogs.length && assessmentLogs.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssessments(new Set(assessmentLogs.map((l) => l.id)));
                          } else {
                            setSelectedAssessments(new Set());
                          }
                        }}
                      />
                      全選択
                    </label>
                    {selectedAssessments.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteAssessments}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        選択削除（{selectedAssessments.size}件）
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            {assessmentLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-muted">判定ログはまだありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assessmentLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                      log.isHandled
                        ? "border-slate-100 opacity-60"
                        : selectedAssessments.has(log.id)
                          ? "border-primary/40 ring-2 ring-primary/10"
                          : "border-slate-200"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-primary"
                            checked={selectedAssessments.has(log.id)}
                            onChange={(e) => {
                              setSelectedAssessments((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(log.id) : next.delete(log.id);
                                return next;
                              });
                            }}
                          />
                        </label>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            log.result === "acceptable"
                              ? "bg-emerald-50 text-emerald-700"
                              : log.result === "safety_risk"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {log.result === "acceptable"
                            ? "受入可能"
                            : log.result === "safety_risk"
                              ? "要慎重検討"
                              : "要相談"}
                        </span>
                        {log.isHandled && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                            済
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">
                          {new Date(log.timestamp).toLocaleString("ja-JP")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteOneAssessment(log.id)}
                          className="ml-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          aria-label="削除"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-5 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
                      <div>
                        <span className="text-muted">疾患:</span>{" "}
                        <span className="font-medium">
                          {log.disease}
                          {log.diseaseOther && `（${log.diseaseOther}）`}
                        </span>
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
                    {(log.medicalDevice || log.selfHarm || log.otherHarm || log.mentalGrade) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {log.medicalDevice && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">医療機器あり</span>
                        )}
                        {log.mentalGrade && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">障害等級: {log.mentalGrade}</span>
                        )}
                        {log.selfHarm && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">自傷あり</span>
                        )}
                        {log.otherHarm && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">他害あり</span>
                        )}
                      </div>
                    )}
                    {log.reason && (
                      <p className="mt-2 text-sm text-muted sm:text-xs">{log.reason}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = toggleAssessmentHandled(log.id);
                          setAssessmentLogs(updated);
                        }}
                        className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition active:scale-[0.98] ${
                          log.isHandled
                            ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {log.isHandled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          ) : (
                            <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} />
                          )}
                        </svg>
                        {log.isHandled ? "対応済みを取消" : "対応完了"}
                      </button>
                      {log.isHandled && log.handledAt && (
                        <span className="text-xs text-muted">
                          対応日時：{new Date(log.handledAt).toLocaleString("ja-JP")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking Logs */}
        {activeTab === "bookings" && (
          <div className="animate-fade-in">
            {bookingLogs.length > 0 && (
              <>
                {/* Stats + bulk toolbar */}
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-700">
                    未対応：<span className="font-bold text-red-600">{bookingLogs.filter((l) => !l.isHandled).length}</span>件
                  </span>
                  <span className="text-sm text-muted">
                    ／ 全{bookingLogs.length}件
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-primary"
                        checked={selectedBookings.size === bookingLogs.length && bookingLogs.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBookings(new Set(bookingLogs.map((l) => l.id)));
                          } else {
                            setSelectedBookings(new Set());
                          }
                        }}
                      />
                      全選択
                    </label>
                    {selectedBookings.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteBookings}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        選択削除（{selectedBookings.size}件）
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            {bookingLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-muted">受付ログはまだありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookingLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                      log.isHandled
                        ? "border-slate-100 opacity-60"
                        : selectedBookings.has(log.id)
                          ? "border-primary/40 ring-2 ring-primary/10"
                          : "border-slate-200"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-primary"
                            checked={selectedBookings.has(log.id)}
                            onChange={(e) => {
                              setSelectedBookings((prev) => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(log.id) : next.delete(log.id);
                                return next;
                              });
                            }}
                          />
                        </label>
                        <span className="text-sm font-bold text-slate-800">
                          {log.facilityName}
                        </span>
                        {log.isHandled && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                            済
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">
                          {new Date(log.timestamp).toLocaleString("ja-JP")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteOneBooking(log.id)}
                          className="ml-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                          aria-label="削除"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
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
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = toggleBookingHandled(log.id);
                          setBookingLogs(updated);
                        }}
                        className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition active:scale-[0.98] ${
                          log.isHandled
                            ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {log.isHandled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          ) : (
                            <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} />
                          )}
                        </svg>
                        {log.isHandled ? "対応済みを取消" : "対応完了"}
                      </button>
                      {log.isHandled && log.handledAt && (
                        <span className="text-xs text-muted">
                          対応日時：{new Date(log.handledAt).toLocaleString("ja-JP")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Data Cleanup — visible when assessments or bookings tab active and logs exist */}
        {(activeTab === "assessments" || activeTab === "bookings") &&
          (assessmentLogs.length > 0 || bookingLogs.length > 0) && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-sm font-bold text-slate-800">期間指定クリーンアップ</h3>
            <p className="mb-4 text-xs text-muted">
              指定日以前の判定ログ・受付ログを一括削除します（取り消し不可）
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-wrap gap-2">
                {CLEANUP_PRESETS.map((preset) => {
                  const cutoff = new Date();
                  cutoff.setMonth(cutoff.getMonth() - preset.months);
                  const cutoffISO = cutoff.toISOString();
                  return (
                    <button
                      key={preset.months}
                      type="button"
                      onClick={() => handleCleanup(cutoffISO, preset.label)}
                      className="flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-red-50 hover:border-red-200 hover:text-red-700 active:scale-[0.98]"
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">日付指定</label>
                  <input
                    type="date"
                    value={cleanupDate}
                    onChange={(e) => setCleanupDate(e.target.value)}
                    className="min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  type="button"
                  disabled={!cleanupDate}
                  onClick={() => {
                    const cutoffISO = new Date(cleanupDate + "T23:59:59").toISOString();
                    handleCleanup(cutoffISO, `${cleanupDate}`);
                  }}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  削除実行
                </button>
              </div>
            </div>
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
                面談受付時にここで登録されたアドレス全てへ通知メールが送信されます
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
