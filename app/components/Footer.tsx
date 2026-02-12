export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 sm:py-6">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-sm text-muted sm:text-xs">
          お急ぎの方は直接お電話ください:{" "}
          <a href="tel:03XXXXXXXX" className="font-medium text-slate-700 underline hover:text-primary">03-XXXX-XXXX</a>{" "}
          （担当：生田）
        </p>
        <p className="mt-2 text-xs text-gray-400">
          運営：株式会社AA
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          &copy; 2026 株式会社AA
        </p>
      </div>
    </footer>
  );
}
