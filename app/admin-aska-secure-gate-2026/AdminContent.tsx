"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import {
  getSlotConfig,
  fetchNotificationEmails,
  saveNotificationEmails,
  FACILITY_IDS,
  FACILITY_LABELS,
  type SlotConfig,
  type AssessmentLog,
  type BookingLog,
  type FacilityId,
} from "@/app/lib/slotStore";

// ---------------------------------------------------------------------------
// localStorage オーバーレイ（対応済み状態・非表示ログ）
// スプレッドシートには isHandled/handledAt 列がないため、ローカルで管理する
// ---------------------------------------------------------------------------
const HANDLED_ASSESSMENTS_KEY = "b2b_handled_assessments";
const HANDLED_BOOKINGS_KEY = "b2b_handled_bookings";
const HIDDEN_ASSESSMENT_IDS_KEY = "b2b_hidden_assessment_ids";
const HIDDEN_BOOKING_IDS_KEY = "b2b_hidden_booking_ids";

type HandledOverlay = Record<string, { isHandled: boolean; handledAt?: string }>;

function getHandledOverlay(key: string): HandledOverlay {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : {};
}

function saveHandledOverlay(key: string, overlay: HandledOverlay) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(overlay));
  }
}

function getHiddenIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const stored = localStorage.getItem(key);
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

function addHiddenIds(key: string, ids: string[]) {
  const hidden = getHiddenIds(key);
  ids.forEach((id) => hidden.add(id));
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify([...hidden]));
  }
}

function mergeAssessmentOverlay(apiLogs: AssessmentLog[]): AssessmentLog[] {
  const hidden = getHiddenIds(HIDDEN_ASSESSMENT_IDS_KEY);
  const handled = getHandledOverlay(HANDLED_ASSESSMENTS_KEY);
  return apiLogs
    .filter((log) => !hidden.has(log.id))
    .map((log) => ({
      ...log,
      isHandled: handled[log.id]?.isHandled ?? false,
      handledAt: handled[log.id]?.handledAt,
    }));
}

function mergeBookingOverlay(apiLogs: BookingLog[]): BookingLog[] {
  const hidden = getHiddenIds(HIDDEN_BOOKING_IDS_KEY);
  const handled = getHandledOverlay(HANDLED_BOOKINGS_KEY);
  return apiLogs
    .filter((log) => !hidden.has(log.id))
    .map((log) => ({
      ...log,
      isHandled: handled[log.id]?.isHandled ?? false,
      handledAt: handled[log.id]?.handledAt,
    }));
}
import { trackEvent } from "@/app/lib/analytics";
import { ALLOWED_DOMAINS } from "@/app/lib/auth";

const ADMIN_PASSWORD = "ikuta2024";

// --- Session management (Cookie-based, equivalent to NextAuth maxAge/updateAge) ---
const SESSION_COOKIE = "b2b_admin_session";
const SESSION_MAX_AGE = 28800; // 8 hours in seconds
const SESSION_UPDATE_AGE = 3600; // 1 hour in seconds
const COOKIE_PATH = "/admin-aska-secure-gate-2026";

function getSessionCookie(): { lastActivity: number } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function setSessionCookie(lastActivity: number) {
  const value = encodeURIComponent(JSON.stringify({ lastActivity }));
  document.cookie = `${SESSION_COOKIE}=${value}; path=${COOKIE_PATH}; max-age=${SESSION_MAX_AGE}; SameSite=Strict`;
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=${COOKIE_PATH}; max-age=0; SameSite=Strict`;
}

function isSessionValid(): boolean {
  const session = getSessionCookie();
  if (!session) return false;
  const elapsed = (Date.now() - session.lastActivity) / 1000;
  return elapsed < SESSION_MAX_AGE;
}

function refreshSessionIfNeeded(): boolean {
  const session = getSessionCookie();
  if (!session) return false;
  const elapsed = (Date.now() - session.lastActivity) / 1000;
  if (elapsed >= SESSION_MAX_AGE) return false;
  if (elapsed >= SESSION_UPDATE_AGE) {
    setSessionCookie(Date.now());
  }
  return true;
}

// --- Lockout management (Cookie-based brute-force protection) ---
const LOCKOUT_COOKIE = "b2b_admin_lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getLockoutCookie(): { attempts: number; lockedUntil: number } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCKOUT_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function setLockoutCookie(data: { attempts: number; lockedUntil: number }) {
  const value = encodeURIComponent(JSON.stringify(data));
  const maxAge = Math.ceil(LOCKOUT_DURATION_MS / 1000) + 60;
  document.cookie = `${LOCKOUT_COOKIE}=${value}; path=${COOKIE_PATH}; max-age=${maxAge}; SameSite=Strict`;
}

function clearLockoutCookie() {
  document.cookie = `${LOCKOUT_COOKIE}=; path=${COOKIE_PATH}; max-age=0; SameSite=Strict`;
}

function checkLockout(): { locked: boolean; remainingMinutes: number } {
  const data = getLockoutCookie();
  if (!data || data.attempts < MAX_ATTEMPTS) return { locked: false, remainingMinutes: 0 };
  const remaining = data.lockedUntil - Date.now();
  if (remaining <= 0) {
    clearLockoutCookie();
    return { locked: false, remainingMinutes: 0 };
  }
  return { locked: true, remainingMinutes: Math.ceil(remaining / 60000) };
}

function recordFailedAttempt(): { locked: boolean; remainingMinutes: number; attempts: number } {
  const data = getLockoutCookie() || { attempts: 0, lockedUntil: 0 };
  data.attempts += 1;
  if (data.attempts >= MAX_ATTEMPTS) {
    data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  setLockoutCookie(data);
  if (data.attempts >= MAX_ATTEMPTS) {
    return { locked: true, remainingMinutes: Math.ceil(LOCKOUT_DURATION_MS / 60000), attempts: data.attempts };
  }
  return { locked: false, remainingMinutes: 0, attempts: data.attempts };
}

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

// ---------------------------------------------------------------------------
// Google認証ゲート
// NextAuthのセッションが無い場合にGoogleログインボタンを表示する。
// ドメイン拒否時（NextAuthのerrorクエリパラメータ）にはエラーメッセージを表示する。
// ---------------------------------------------------------------------------
function GoogleAuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [errorType, setErrorType] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setErrorType(err);
      // URLからerrorパラメータを除去（表示は維持）
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4">
          <div className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
            <p className="text-sm text-muted">認証状態を確認中...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!session) {
    const domainHint = ALLOWED_DOMAINS.map((d) => `@${d}`).join(", ");
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4">
          <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-center text-lg font-bold text-slate-800">管理画面</h1>
            <p className="mb-6 text-center text-sm text-muted">
              アクセスにはGoogleアカウント認証が必要です
            </p>

            {errorType && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-700">
                  このアカウントではアクセスできません。
                </p>
                <p className="mt-1 text-xs text-red-600">
                  {domainHint} のアカウントでログインしてください。
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/admin-aska-secure-gate-2026" })}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Googleアカウントでログイン
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Google認証済み → children（パスワード認証画面 or 管理画面）を表示
  return <>{children}</>;
}

function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [lockout, setLockout] = useState<{ locked: boolean; remainingMinutes: number }>({ locked: false, remainingMinutes: 0 });

  // Check lockout on mount + periodic countdown
  useEffect(() => {
    setLockout(checkLockout());
    const timer = setInterval(() => {
      setLockout(checkLockout());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lockState = checkLockout();
    if (lockState.locked) {
      setLockout(lockState);
      return;
    }
    if (pw === ADMIN_PASSWORD) {
      clearLockoutCookie();
      setSessionCookie(Date.now());
      onAuth();
    } else {
      const result = recordFailedAttempt();
      if (result.locked) {
        setLockout({ locked: true, remainingMinutes: result.remainingMinutes });
        setError("");
      } else {
        setError(`パスワードが正しくありません（${result.attempts}/${MAX_ATTEMPTS}回）`);
      }
    }
  };

  const isLocked = lockout.locked;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-4">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-center text-lg font-bold text-slate-800">管理画面ログイン</h1>

          {isLocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
              <p className="mb-1 text-sm font-bold text-red-700">
                ログインが一時的にロックされています
              </p>
              <p className="text-xs text-red-600">
                パスワードの入力に{MAX_ATTEMPTS}回連続で失敗したため、約{lockout.remainingMinutes}分間ログインできません。
              </p>
              <p className="mt-2 text-xs text-muted">
                しばらくしてからもう一度お試しください。
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">パスワード</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError(""); }}
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              {error && <p className="mb-3 text-xs text-red-600">{error}</p>}
              <button type="submit" className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-white transition hover:bg-primary-dark">
                ログイン
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AdminPageContent() {
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
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
  const [expandedAssessments, setExpandedAssessments] = useState<Set<string>>(new Set());
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError("");

    // スロット・判定ログ・受付ログを Promise.all で並列取得
    const [slotsResult, assessmentsResult, bookingsResult] = await Promise.all([
      fetch("/api/slots")
        .then((r) => r.json())
        .then((data) => ({ ok: true as const, data: data as Record<FacilityId, SlotConfig> }))
        .catch(() => ({ ok: false as const, data: null })),
      fetch("/api/assessment-logs")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => ({ ok: true as const, data: data as AssessmentLog[] }))
        .catch(() => ({ ok: false as const, data: null })),
      fetch("/api/booking-logs")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => ({ ok: true as const, data: data as BookingLog[] }))
        .catch(() => ({ ok: false as const, data: null })),
    ]);

    // スロット
    if (slotsResult.ok && slotsResult.data) {
      setFacilitySlots(slotsResult.data);
    } else {
      const slots = {} as Record<FacilityId, SlotConfig>;
      for (const id of FACILITY_IDS) {
        slots[id] = getSlotConfig(id);
      }
      setFacilitySlots(slots);
    }

    // 判定ログ
    if (assessmentsResult.ok && assessmentsResult.data) {
      setAssessmentLogs(mergeAssessmentOverlay(assessmentsResult.data));
    } else {
      setAssessmentLogs([]);
    }

    // 受付ログ
    if (bookingsResult.ok && bookingsResult.data) {
      setBookingLogs(mergeBookingOverlay(bookingsResult.data));
    } else {
      setBookingLogs([]);
    }

    // エラー表示（ログ取得に両方失敗した場合のみ）
    if (!assessmentsResult.ok && !bookingsResult.ok) {
      setLoadError("ログデータの取得に失敗しました。ネットワーク接続を確認してください。");
    } else if (!assessmentsResult.ok) {
      setLoadError("判定ログの取得に失敗しました。");
    } else if (!bookingsResult.ok) {
      setLoadError("受付ログの取得に失敗しました。");
    }

    fetchNotificationEmails().then((emails) => setNotifyEmails(emails));
    setLoading(false);
  };

  // Session check on mount
  useEffect(() => {
    if (isSessionValid()) {
      refreshSessionIfNeeded();
      setAuthed(true);
    }
  }, []);

  // Silent refresh: check session every 60s, refresh if active, expire if stale
  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(() => {
      if (!refreshSessionIfNeeded()) {
        clearSessionCookie();
        setAuthed(false);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [authed]);

  useEffect(() => {
    if (authed) loadData();
  }, [authed]);

  if (!authed) {
    return <AdminAuth onAuth={() => setAuthed(true)} />;
  }

  const handleReload = (facilityId: FacilityId) => {
    const previousSlots = facilitySlots ? { ...facilitySlots } : null;
    const totalSlots = newTotals[facilityId];
    const now = new Date();
    // 楽観的更新
    setFacilitySlots((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [facilityId]: {
          totalSlots,
          usedSlots: 0,
          lastReloadDate: now.toISOString().split("T")[0],
          lastReloadTimestamp: now.toISOString(),
          status: totalSlots > 0 ? "available" : "adjusting",
        } as SlotConfig,
      };
    });
    trackEvent("admin_action", "reload_slots", `${facilityId}=${totalSlots}`);
    showToast(`${FACILITY_LABELS[facilityId]}の空室状況を更新しました`);
    // バックグラウンド POST
    fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reload", facilityId, totalSlots }),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok || result.error) throw new Error(result.error || "不明なエラー");
        if (result.slots) setFacilitySlots(result.slots as Record<FacilityId, SlotConfig>);
      })
      .catch((e) => {
        console.error("[admin] リロードエラー:", e);
        if (previousSlots) setFacilitySlots(previousSlots);
        showToast("更新に失敗しました。ネットワーク接続を確認してください。");
      });
  };

  // --- Delete handlers ---
  const handleDeleteOneAssessment = (id: string) => {
    setConfirmAction({
      title: "ログの削除",
      message: "このログを削除してもよろしいですか？",
      onConfirm: () => {
        addHiddenIds(HIDDEN_ASSESSMENT_IDS_KEY, [id]);
        setAssessmentLogs((prev) => prev.filter((l) => l.id !== id));
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
        addHiddenIds(HIDDEN_BOOKING_IDS_KEY, [id]);
        setBookingLogs((prev) => prev.filter((l) => l.id !== id));
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
        addHiddenIds(HIDDEN_ASSESSMENT_IDS_KEY, [...selectedAssessments]);
        setAssessmentLogs((prev) => prev.filter((l) => !selectedAssessments.has(l.id)));
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
        addHiddenIds(HIDDEN_BOOKING_IDS_KEY, [...selectedBookings]);
        setBookingLogs((prev) => prev.filter((l) => !selectedBookings.has(l.id)));
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
      "種別", "ID", "タイムスタンプ", "拠点名", "判定結果", "疾患", "疾患詳細", "ADL",
      "認知症レベル", "生活保護", "医療機器", "障害等級", "自傷", "他害",
      "性別", "予算", "時期", "理由",
      "トリガーフラグ", "リピーター", "記録元", "対応済", "対応日時",
    ];
    const bookingHeader = [
      "種別", "ID", "タイムスタンプ", "施設名", "担当者名", "電話番号",
      "メール", "第1希望日", "第1希望時間", "第2希望日", "第2希望時間",
      "第3希望日", "第3希望時間", "確度判定", "疾患", "ADL", "判定補足",
      "備考", "リピーター", "対応済", "対応日時",
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

    // Assessment rows section
    rows.push(assessmentHeader.map(esc).join(","));
    for (const l of assessmentLogs) {
      rows.push(pad([
        "判定", l.id, l.timestamp, l.facilityName || "",
        l.result === "acceptable" ? "受入可能" : l.result === "safety_risk" ? "要慎重検討" : "要相談",
        l.disease, l.diseaseOther || "", l.adl, l.dementiaLevel || "",
        l.welfare || "",
        l.medicalDevice ? "あり" : "", l.mentalGrade || "",
        l.selfHarm ? "あり" : "", l.otherHarm ? "あり" : "",
        l.gender, l.budget, l.timing,
        l.reason || "", (l.triggerFlags || []).join(";"),
        l.isRepeater || "", l.source || "",
        l.isHandled ? "済" : "未", l.handledAt || "",
      ].map(esc)).join(","));
    }

    rows.push(""); // blank separator

    // Booking rows section
    rows.push(bookingHeader.map(esc).join(","));
    for (const l of bookingLogs) {
      rows.push(pad([
        "受付", l.id, l.timestamp, l.facilityName, l.contactName, l.phone,
        l.email, l.preferredDate, l.preferredTime,
        l.preferredDate2 || "", l.preferredTime2 || "",
        l.preferredDate3 || "", l.preferredTime3 || "",
        l.assessmentStatus || "", l.assessmentDisease || "",
        l.assessmentAdl || "", l.assessmentReason || "",
        l.notes, l.isRepeater || "",
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
        const aToHide = assessmentLogs.filter((l) => l.timestamp < cutoffISO).map((l) => l.id);
        const bToHide = bookingLogs.filter((l) => l.timestamp < cutoffISO).map((l) => l.id);
        addHiddenIds(HIDDEN_ASSESSMENT_IDS_KEY, aToHide);
        addHiddenIds(HIDDEN_BOOKING_IDS_KEY, bToHide);
        setAssessmentLogs((prev) => prev.filter((l) => l.timestamp >= cutoffISO));
        setBookingLogs((prev) => prev.filter((l) => l.timestamp >= cutoffISO));
        setSelectedAssessments(new Set());
        setSelectedBookings(new Set());
        setConfirmAction(null);
        showToast(`${total}件のログを削除しました`);
      },
    });
  };

  if (!facilitySlots || loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          <h1 className="mb-6 text-2xl font-bold text-slate-800">管理画面</h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 h-5 w-32 rounded bg-slate-200" />
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-16 rounded-lg bg-slate-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
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
          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => {
                clearSessionCookie();
                signOut({ callbackUrl: "/admin-aska-secure-gate-2026" });
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ログアウト
            </button>
          </div>
        </div>

        {/* Error banner */}
        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-700">{loadError}</p>
          </div>
        )}

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
                    {/* サマリー行: 疾患・ADL・予算 */}
                    <div className="grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-4 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
                      {log.facilityName && (
                        <div>
                          <span className="text-muted">拠点:</span>{" "}
                          <span className="font-medium">{log.facilityName}</span>
                        </div>
                      )}
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
                        <span className="text-muted">予算:</span>{" "}
                        <span className="font-medium">{log.budget}</span>
                      </div>
                    </div>
                    {/* 展開ボタン */}
                    <button
                      type="button"
                      onClick={() => setExpandedAssessments((prev) => {
                        const next = new Set(prev);
                        next.has(log.id) ? next.delete(log.id) : next.add(log.id);
                        return next;
                      })}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition"
                    >
                      <svg className={`h-3.5 w-3.5 transition-transform ${expandedAssessments.has(log.id) ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      {expandedAssessments.has(log.id) ? "詳細を閉じる" : "詳細を表示"}
                    </button>
                    {/* 展開時の詳細表示 */}
                    {expandedAssessments.has(log.id) && (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 sm:text-xs">
                          {log.facilityName && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">拠点名</dt>
                              <dd className="font-medium">{log.facilityName}</dd>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">判定結果</dt>
                            <dd className="font-medium">
                              {log.result === "acceptable" ? "受入可能" : log.result === "safety_risk" ? "要慎重検討" : "要相談"}
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">疾患</dt>
                            <dd className="font-medium">{log.disease}{log.diseaseOther ? `（${log.diseaseOther}）` : ""}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">ADL</dt>
                            <dd className="font-medium">{log.adl}</dd>
                          </div>
                          {log.dementiaLevel && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">認知症レベル</dt>
                              <dd className="font-medium">{log.dementiaLevel}</dd>
                            </div>
                          )}
                          {log.gender && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">性別</dt>
                              <dd className="font-medium">{log.gender}</dd>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">予算</dt>
                            <dd className="font-medium">{log.budget}</dd>
                          </div>
                          {log.timing && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">入居希望時期</dt>
                              <dd className="font-medium">{log.timing}</dd>
                            </div>
                          )}
                          {log.welfare && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">生活保護</dt>
                              <dd className="font-medium">{log.welfare}</dd>
                            </div>
                          )}
                          {(log.medicalDevice || log.mentalGrade || log.selfHarm || log.otherHarm) && (
                            <div className="flex gap-2 sm:col-span-2">
                              <dt className="shrink-0 text-muted w-24">特記事項</dt>
                              <dd className="flex flex-wrap gap-1.5">
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
                              </dd>
                            </div>
                          )}
                          {log.reason && (
                            <div className="flex gap-2 sm:col-span-2">
                              <dt className="shrink-0 text-muted w-24">判定補足</dt>
                              <dd className="font-medium">{log.reason}</dd>
                            </div>
                          )}
                          {log.isRepeater && log.isRepeater !== "いいえ" && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">リピーター</dt>
                              <dd className="font-medium">{log.isRepeater}</dd>
                            </div>
                          )}
                          {log.source && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">記録元</dt>
                              <dd className="font-medium">{log.source === "direct" ? "判定フォーム" : log.source === "booking_linked" ? "受付連動" : log.source}</dd>
                            </div>
                          )}
                          {log.triggerFlags && log.triggerFlags.length > 0 && (
                            <div className="flex gap-2 sm:col-span-2">
                              <dt className="shrink-0 text-muted w-24">トリガー</dt>
                              <dd className="font-medium text-xs">{log.triggerFlags.join(", ")}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const overlay = getHandledOverlay(HANDLED_ASSESSMENTS_KEY);
                          const current = overlay[log.id]?.isHandled ?? false;
                          overlay[log.id] = {
                            isHandled: !current,
                            handledAt: !current ? new Date().toISOString() : undefined,
                          };
                          saveHandledOverlay(HANDLED_ASSESSMENTS_KEY, overlay);
                          setAssessmentLogs((prev) =>
                            prev.map((l) =>
                              l.id === log.id
                                ? { ...l, isHandled: !current, handledAt: !current ? new Date().toISOString() : undefined }
                                : l
                            )
                          );
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
                    {/* サマリー行: 担当者・電話・第1希望 */}
                    <div className="grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-3 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
                      <div>
                        <span className="text-muted">担当者:</span>{" "}
                        <span className="font-medium">{log.contactName}</span>
                      </div>
                      <div>
                        <span className="text-muted">電話:</span>{" "}
                        <span className="font-medium">{log.phone}</span>
                      </div>
                      <div>
                        <span className="text-muted">第1希望:</span>{" "}
                        <span className="font-medium">
                          {log.preferredDate} {log.preferredTime || "指定なし"}
                        </span>
                      </div>
                    </div>
                    {/* 展開ボタン */}
                    <button
                      type="button"
                      onClick={() => setExpandedBookings((prev) => {
                        const next = new Set(prev);
                        next.has(log.id) ? next.delete(log.id) : next.add(log.id);
                        return next;
                      })}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition"
                    >
                      <svg className={`h-3.5 w-3.5 transition-transform ${expandedBookings.has(log.id) ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                      {expandedBookings.has(log.id) ? "詳細を閉じる" : "詳細を表示"}
                    </button>
                    {/* 展開時の詳細表示 */}
                    {expandedBookings.has(log.id) && (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 sm:text-xs">
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">施設名</dt>
                            <dd className="font-medium">{log.facilityName}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">担当者名</dt>
                            <dd className="font-medium">{log.contactName}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">電話番号</dt>
                            <dd className="font-medium">{log.phone}</dd>
                          </div>
                          {log.email && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">メール</dt>
                              <dd className="font-medium">{log.email}</dd>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <dt className="shrink-0 text-muted w-24">第1希望</dt>
                            <dd className="font-medium">{log.preferredDate} {log.preferredTime || "指定なし"}</dd>
                          </div>
                          {log.preferredDate2 && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">第2希望</dt>
                              <dd className="font-medium">{log.preferredDate2} {log.preferredTime2 || "指定なし"}</dd>
                            </div>
                          )}
                          {log.preferredDate3 && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">第3希望</dt>
                              <dd className="font-medium">{log.preferredDate3} {log.preferredTime3 || "指定なし"}</dd>
                            </div>
                          )}
                          {log.assessmentStatus && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">確度判定</dt>
                              <dd className="font-medium">{log.assessmentStatus}</dd>
                            </div>
                          )}
                          {log.assessmentDisease && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">疾患</dt>
                              <dd className="font-medium">{log.assessmentDisease}</dd>
                            </div>
                          )}
                          {log.assessmentAdl && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">ADL</dt>
                              <dd className="font-medium">{log.assessmentAdl}</dd>
                            </div>
                          )}
                          {log.assessmentReason && (
                            <div className="flex gap-2 sm:col-span-2">
                              <dt className="shrink-0 text-muted w-24">判定補足</dt>
                              <dd className="font-medium">{log.assessmentReason}</dd>
                            </div>
                          )}
                          {log.notes && (
                            <div className="flex gap-2 sm:col-span-2">
                              <dt className="shrink-0 text-muted w-24">備考</dt>
                              <dd className="font-medium">{log.notes}</dd>
                            </div>
                          )}
                          {log.isRepeater && log.isRepeater !== "いいえ" && (
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted w-24">リピーター</dt>
                              <dd className="font-medium">{log.isRepeater}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const overlay = getHandledOverlay(HANDLED_BOOKINGS_KEY);
                          const current = overlay[log.id]?.isHandled ?? false;
                          overlay[log.id] = {
                            isHandled: !current,
                            handledAt: !current ? new Date().toISOString() : undefined,
                          };
                          saveHandledOverlay(HANDLED_BOOKINGS_KEY, overlay);
                          setBookingLogs((prev) =>
                            prev.map((l) =>
                              l.id === log.id
                                ? { ...l, isHandled: !current, handledAt: !current ? new Date().toISOString() : undefined }
                                : l
                            )
                          );
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
                  onKeyDown={async (e) => {
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
                      setNotifyEmails(updated);
                      setNewEmail("");
                      const ok = await saveNotificationEmails(updated);
                      if (!ok) {
                        setEmailError("保存に失敗しました。再度お試しください。");
                        setNotifyEmails(notifyEmails);
                      } else {
                        showToast("通知先を追加しました");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
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
                    setNotifyEmails(updated);
                    setNewEmail("");
                    const ok = await saveNotificationEmails(updated);
                    if (!ok) {
                      setEmailError("保存に失敗しました。再度お試しください。");
                      setNotifyEmails(notifyEmails);
                    } else {
                      showToast("通知先を追加しました");
                    }
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
                        onClick={async () => {
                          const updated = notifyEmails.filter((_, idx) => idx !== i);
                          setNotifyEmails(updated);
                          const ok = await saveNotificationEmails(updated);
                          if (!ok) {
                            setEmailError("削除に失敗しました。再度お試しください。");
                            setNotifyEmails(notifyEmails);
                          } else {
                            showToast("通知先を削除しました");
                          }
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

export default function AdminContent() {
  return (
    <GoogleAuthGate>
      <AdminPageContent />
    </GoogleAuthGate>
  );
}
