"use client";

import { useState } from "react";

export default function TermsAppendixToggle({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAppendix, setShowAppendix] = useState(false);

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setShowAppendix(!showAppendix)}
        className="flex w-full items-center justify-between px-5 py-4 text-left sm:px-8"
        aria-expanded={showAppendix}
      >
        <span className="text-base font-bold text-slate-800">
          【別紙】入居候補者様向けご案内
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${showAppendix ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {showAppendix && (
        <div className="border-t border-slate-200 px-5 py-5 sm:px-8">
          {children}
        </div>
      )}
    </div>
  );
}
