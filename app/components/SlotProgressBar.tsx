"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FACILITY_IDS,
  FACILITY_LABELS,
  type FacilityId,
  type SlotConfig,
} from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

/** ポーリング間隔（ミリ秒）。後から調整しやすいよう定数化。 */
const POLLING_INTERVAL_MS = 60_000; // 1分

/** stale-while-revalidate 用の localStorage キー */
const CACHE_KEY = "b2b_slot_cache";

/** 管理画面からのリロード通知用 localStorage キー */
const INVALIDATION_KEY = "b2b_slot_invalidated_at";

function getElapsedLabel(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.floor(hr / 24)}日前`;
}

interface SlotProgressBarProps {
  facilityId?: string;
  onSlotsLoaded?: (data: Record<string, SlotConfig>) => void;
}

function readCache(): Record<string, SlotConfig> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data: Record<string, SlotConfig>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded — ignore
  }
}

function extractSlotInfo(
  data: Record<string, SlotConfig>,
  facilityId?: string,
): { total: number; used: number; ts: string; label: string } {
  if (
    facilityId &&
    facilityId !== "any" &&
    FACILITY_IDS.includes(facilityId as FacilityId)
  ) {
    const c = data[facilityId] || {
      totalSlots: 0,
      usedSlots: 0,
      lastReloadTimestamp: new Date().toISOString(),
    };
    return {
      total: c.totalSlots,
      used: c.usedSlots,
      ts: c.lastReloadTimestamp || c.lastReloadDate,
      label: FACILITY_LABELS[facilityId as FacilityId],
    };
  }

  let t = 0,
    u = 0,
    ts = "";
  for (const id of FACILITY_IDS) {
    const c = data[id];
    if (c) {
      t += c.totalSlots;
      u += c.usedSlots;
      if (c.lastReloadTimestamp > ts) ts = c.lastReloadTimestamp;
    }
  }
  if (!ts) ts = new Date().toISOString();
  return { total: t, used: u, ts, label: "全拠点合計" };
}

export default function SlotProgressBar({ facilityId, onSlotsLoaded }: SlotProgressBarProps) {
  const [total, setTotal] = useState(0);
  const [used, setUsed] = useState(0);
  const [elapsed, setElapsed] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
  const [ready, setReady] = useState(false);
  const trackedRef = useRef(false);
  const onSlotsLoadedRef = useRef(onSlotsLoaded);
  onSlotsLoadedRef.current = onSlotsLoaded;

  const applyData = useCallback(
    (data: Record<string, SlotConfig>) => {
      const info = extractSlotInfo(data, facilityId);
      setTotal(info.total);
      setUsed(info.used);
      setElapsed(getElapsedLabel(info.ts));
      setStatusLabel(info.label);
      setReady(true);

      onSlotsLoadedRef.current?.(data);

      if (!trackedRef.current) {
        trackedRef.current = true;
        trackEvent(
          "slot_view",
          "view_progress_bar",
          `${info.total - info.used}/${info.total}`,
        );
      }
    },
    [facilityId],
  );

  const fetchSlots = useCallback((bustCache = false) => {
    const url = bustCache ? `/api/slots?t=${Date.now()}` : "/api/slots";
    fetch(url)
      .then((res) => res.json())
      .then((data: Record<string, SlotConfig>) => {
        writeCache(data);
        applyData(data);
      })
      .catch(() => {
        // フェッチ失敗時はキャッシュがなければデフォルト表示
        if (!ready) setReady(true);
      });
  }, [applyData, ready]);

  // --- 初回: stale-while-revalidate ---
  useEffect(() => {
    // キャッシュがあれば即座に描画
    const cached = readCache();
    if (cached) {
      applyData(cached);
    }
    // 裏で最新データを取得
    fetchSlots();
  }, [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- ポーリング（フォアグラウンド時のみ） ---
  useEffect(() => {
    if (!ready) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      stopPolling();
      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchSlots();
        }
      }, POLLING_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // タブ復帰時に即座に再取得
        fetchSlots();
        startPolling();
      } else {
        stopPolling();
      }
    };

    // 初期起動
    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ready, fetchSlots]);

  // --- 管理画面からのリロード通知を検知して即時再取得 ---
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === INVALIDATION_KEY && e.newValue) {
        fetchSlots(true);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [fetchSlots]);

  if (!ready) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100" />;
  }

  const remaining = Math.max(0, total - used);
  const ratio = total > 0 ? used / total : 0;
  const isAdjusting = remaining === 0;

  // Dynamic color tiers based on remaining ratio
  const getBarColor = (): string => {
    if (ratio >= 0.8) return "bg-red-500";
    if (ratio >= 0.6) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getIndicatorColor = (): string => {
    if (isAdjusting) return "bg-red-500 animate-pulse-slow";
    if (ratio >= 0.8) return "bg-red-500";
    if (ratio >= 0.6) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getRemainingColor = (): string => {
    if (ratio >= 0.8) return "text-red-600";
    if (ratio >= 0.6) return "text-amber-600";
    return "text-primary";
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${getIndicatorColor()}`}
          />
          <h3 className="text-sm font-bold text-slate-800">
            今週の優先面談枠（{statusLabel}）
          </h3>
        </div>
        {isAdjusting ? (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
            満室
          </span>
        ) : (
          <span className={`text-lg font-bold ${getRemainingColor()}`}>
            残り{remaining}枠
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-2 flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-4 flex-1 rounded-sm transition-colors ${
              i < used
                ? getBarColor()
                : "bg-slate-100 border border-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Text representation */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {Array.from({ length: total })
            .map((_, i) => (i < used ? "\u25A0" : "\u25A1"))
            .join("")}
        </span>
        <span>
          {used}/{total} 枠使用中
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {isAdjusting ? (
          <p className="text-xs font-medium leading-tight text-red-600">
            ※ キャンセル待ち・空き予定の確認は可能です
          </p>
        ) : ratio >= 0.6 ? (
          <p className="text-xs font-medium text-amber-600">
            ※ 優先面談枠が残りわずかです
          </p>
        ) : <span />}
        <p className="text-xs text-muted">
          最終更新：{elapsed}
        </p>
      </div>
    </div>
  );
}
