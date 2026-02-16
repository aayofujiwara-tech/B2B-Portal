export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 sm:py-6">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-sm text-muted sm:text-xs">
          お急ぎの方は直接お電話ください:{" "}
          <a href="tel:07032445497" className="font-medium text-slate-700 underline hover:text-primary">070-3244-5497</a>{" "}
          （担当：生田）
        </p>
        <p className="mt-2 text-xs text-gray-400">
          運営：株式会社AA
        </p>
        <p className="mt-1 text-xs text-gray-400">
          〒555-0022 大阪府大阪市西淀川区柏里2-9-3 シャンクレール塚本102号室
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          TEL/FAX：<a href="tel:0644002901" className="hover:text-primary">06-4400-2901</a>
        </p>
        <div className="mt-2 text-xs">
          <a href="/terms" className="text-gray-500 underline hover:text-primary">
            利用規約・個人情報取扱特約
          </a>
          <span className="mx-2 text-gray-300">｜</span>
          <a
            href="https://www.aa-gp.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 underline hover:text-primary"
          >
            運営会社
          </a>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          &copy; 2026 株式会社AA
        </p>
      </div>
    </footer>
  );
}
