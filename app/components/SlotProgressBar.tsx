"use client";

import { useEffect, useState } from "react";
import { getSlotConfig, type SlotConfig } from "@/app/lib/slotStore";
import { trackEvent } from "@/app/lib/analytics";

export default function SlotProgressBar() {
  const [config, setConfig] = useState<SlotConfig | null>(null);

  useEffect(() => {
    const c = getSlotConfig();
    setConfig(c);
    trackEvent(
      "slot_view",
      "view_progress_bar",
      `${c.totalSlots - c.usedSlots}/${c.totalSlots}`
    );
  }, []);

  if (!config) {
    return (
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
    );
  }

  const remaining = Math.max(0, config.totalSlots - config.usedSlots);
  const ratio = config.usedSlots / config.totalSlots;
  const isAdjusting = config.status === "adjusting" || remaining === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${isAdjusting ? "bg-amber-400 animate-pulse-slow" : "bg-emerald-500"}`}
          />
          <h3 className="text-sm font-bold text-slate-800">
            今週の緊急受入枠
          </h3>
        </div>
        {isAdjusting ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            次回の枠を調整中
          </span>
        ) : (
          <span className="text-lg font-bold text-primary">
            残り{remaining}枠
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-2 flex gap-1.5">
        {Array.from({ length: config.totalSlots }).map((_, i) => (
          <div
            key={i}
            className={`h-4 flex-1 rounded-sm transition-colors ${
              i < config.usedSlots
                ? "bg-primary"
                : "bg-slate-100 border border-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Text representation */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {Array.from({ length: config.totalSlots })
            .map((_, i) => (i < config.usedSlots ? "\u25A0" : "\u25A1"))
            .join("")}
        </span>
        <span>
          {config.usedSlots}/{config.totalSlots} 枠使用中
        </span>
      </div>

      {ratio >= 0.6 && !isAdjusting && (
        <p className="mt-2 text-xs font-medium text-amber-600">
          ※ 残り枠がわずかです。お早めにご判定ください。
        </p>
      )}
    </div>
  );
}
