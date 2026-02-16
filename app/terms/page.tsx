import fs from "fs";
import path from "path";
import ReactMarkdown from "react-markdown";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import TermsAppendixToggle from "@/app/components/TermsAppendixToggle";

export default function TermsPage() {
  const filePath = path.join(process.cwd(), "public", "legal", "terms.md");
  const text = fs.readFileSync(filePath, "utf-8");

  const separator = "## 【別紙】入居候補者様向けご案内";
  const idx = text.indexOf(separator);
  const content = idx !== -1 ? text.slice(0, idx).trimEnd() : text;
  const appendix = idx !== -1 ? text.slice(idx) : "";

  const mdComponents = {
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-4 mt-8 border-b border-slate-200 pb-2 text-lg font-bold text-slate-800 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-3 mt-6 text-base font-bold text-slate-700">
        {children}
      </h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-3 text-sm leading-relaxed text-slate-600">
        {children}
      </p>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-3 list-decimal space-y-1.5 pl-6 text-sm leading-relaxed text-slate-600">
        {children}
      </ol>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-3 list-disc space-y-1 pl-6 text-sm leading-relaxed text-slate-600">
        {children}
      </ul>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="pl-1">{children}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-slate-800">{children}</strong>
    ),
    hr: () => <hr className="my-6 border-slate-200" />,
    a: ({
      href,
      children,
    }: {
      href?: string;
      children?: React.ReactNode;
    }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary-dark"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="mb-4 border-l-4 border-slate-300 pl-4 text-sm italic text-slate-500">
        {children}
      </blockquote>
    ),
  };

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

          <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
        </div>

        {/* 別紙（アコーディオン） */}
        {appendix && (
          <TermsAppendixToggle>
  
            <ReactMarkdown components={mdComponents}>{appendix}</ReactMarkdown>
          </TermsAppendixToggle>
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
