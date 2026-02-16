"use client";

import dynamic from "next/dynamic";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const AdminContent = dynamic(() => import("./AdminContent"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">管理画面</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
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
  ),
});

export default function AdminPage() {
  return <AdminContent />;
}
