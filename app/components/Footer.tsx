export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6">
      <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted">
        <p>
          &copy; {new Date().getFullYear()} 居室サブリース &times;
          訪問看護ステーション
        </p>
        <p className="mt-1">
          お急ぎの方は直接お電話ください:{" "}
          <a href="tel:03XXXXXXXX" className="font-medium text-slate-700 underline hover:text-primary">03-XXXX-XXXX</a>{" "}
          （担当：生田）
        </p>
      </div>
    </footer>
  );
}
