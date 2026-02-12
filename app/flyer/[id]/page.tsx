"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import {
  FACILITY_IDS,
  FACILITY_LABELS,
  type FacilityId,
} from "@/app/lib/slotStore";

const FLYER_FILES: Record<FacilityId, string> = {
  tsukamoto: "/pdf/flyer-tsukamoto.pdf",
  toyoshin: "/pdf/flyer-houshin.pdf",
  utajima: "/pdf/flyer-utajima.pdf",
};

const FLYER_DESCRIPTIONS: Record<FacilityId, string> = {
  tsukamoto: "JR塚本駅 徒歩7分 / 鉄骨7階建 / 賃料4.0万円〜",
  toyoshin: "阪急上新庄駅 徒歩10分 / 鉄骨10階建 / 賃料4.0万円〜",
  utajima: "JR塚本駅 徒歩8分 / 鉄骨6階建 / 賃料4.0万円〜",
};

export default function FlyerPage() {
  const params = useParams();
  const id = params.id as string;

  const isValidFacility = FACILITY_IDS.includes(id as FacilityId);

  if (!isValidFacility) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20">
          <p className="mb-4 text-muted">指定された施設が見つかりません</p>
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            トップに戻る
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const facilityId = id as FacilityId;
  const label = FACILITY_LABELS[facilityId];
  const pdfPath = FLYER_FILES[facilityId];
  const description = FLYER_DESCRIPTIONS[facilityId];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="mb-1 text-2xl font-bold text-slate-800">
            ええすまい {label} チラシ
          </h1>
          <p className="text-sm text-muted">{description}</p>
        </div>

        {/* Facility tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
          {FACILITY_IDS.map((fid) => (
            <Link
              key={fid}
              href={`/flyer/${fid}`}
              className={`flex-1 rounded-md py-2.5 text-center text-xs font-medium transition sm:py-2 sm:text-sm ${
                fid === facilityId
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-muted hover:text-slate-600"
              }`}
            >
              {FACILITY_LABELS[fid]}
            </Link>
          ))}
        </div>

        {/* PDF Embed */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <embed
            src={pdfPath}
            type="application/pdf"
            className="h-[60vh] w-full sm:h-[80vh]"
          />
        </div>

        {/* Fallback download link */}
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted">
            PDFが表示されない場合は下のボタンからダウンロードしてください
          </p>
          <a
            href={pdfPath}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/10"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            PDFをダウンロード
          </a>
        </div>

        {/* Back to top */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            入居判定に戻る
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
