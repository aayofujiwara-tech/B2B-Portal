"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function TermsPage() {
  const [content, setContent] = useState("");
  const [appendix, setAppendix] = useState("");
  const [showAppendix, setShowAppendix] = useState(false);

  useEffect(() => {
    fetch("/legal/terms.md")
      .then((res) => res.text())
      .then((text) => {
        const separator = "## 【別紙】入居候補者様向けご案内";
        const idx = text.indexOf(separator);
        if (idx !== -1) {
          setContent(text.slice(0, idx).trimEnd());
          setAppendix(text.slice(idx));
        } else {
          setContent(text);
        }
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:py-8">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-slate-800">
            利用規約・個人情報取扱特約
          </h1>
          <p className="text-sm text-muted">最終更新日：2026年2月16日</p>
        </div>

        {/* 本文 */}
        <div className="terms-content rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="mb-4 mt-8 border-b border-slate-200 pb-2 text-lg font-bold text-slate-800 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-3 mt-6 text-base font-bold text-slate-700">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="mb-3 text-sm leading-relaxed text-slate-600">
                  {children}
                </p>
              ),
              ol: ({ children }) => (
                <ol className="mb-3 list-decimal space-y-1.5 pl-6 text-sm leading-relaxed text-slate-600">
                  {children}
                </ol>
              ),
              ul: ({ children }) => (
                <ul className="mb-3 list-disc space-y-1 pl-6 text-sm leading-relaxed text-slate-600">
                  {children}
                </ul>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-bold text-slate-800">{children}</strong>
              ),
              hr: () => <hr className="my-6 border-slate-200" />,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary-dark"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="mb-4 border-l-4 border-slate-300 pl-4 text-sm italic text-slate-500">
                  {children}
                </blockquote>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* 別紙（アコーディオン） */}
        {appendix && (
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
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="mb-4 text-lg font-bold text-slate-800">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-3 mt-6 text-base font-bold text-slate-700">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-3 text-sm leading-relaxed text-slate-600">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-3 list-disc space-y-1 pl-6 text-sm leading-relaxed text-slate-600">
                        {children}
                      </ul>
                    ),
                    li: ({ children }) => (
                      <li className="pl-1">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-slate-800">
                        {children}
                      </strong>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="mb-4 border-l-4 border-slate-300 pl-4 text-sm italic text-slate-500">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:text-primary-dark"
                      >
                        {children}
                      </a>
                    ),
                    hr: () => <hr className="my-6 border-slate-200" />,
                  }}
                >
                  {appendix}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      {/* 印刷対応 */}
      <style>{`
        @media print {
          header, footer, nav { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          .terms-content { border: none !important; box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
