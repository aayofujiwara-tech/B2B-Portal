"use client";

interface ConsentCheckboxProps {
  agreedTerms: boolean;
  agreedConsent: boolean;
  onChangeTerms: (v: boolean) => void;
  onChangeConsent: (v: boolean) => void;
}

export default function ConsentCheckbox({
  agreedTerms,
  agreedConsent,
  onChangeTerms,
  onChangeConsent,
}: ConsentCheckboxProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {/* チェックボックス1: 利用規約同意 */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 transition hover:border-slate-300">
        <input
          type="checkbox"
          checked={agreedTerms}
          onChange={(e) => onChangeTerms(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-primary accent-primary sm:h-4 sm:w-4"
        />
        <span className="text-sm leading-relaxed text-slate-700">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline hover:text-primary-dark"
            onClick={(e) => e.stopPropagation()}
          >
            利用規約・個人情報取扱特約
          </a>
          に同意します
        </span>
      </label>

      {/* チェックボックス2: 本人同意の確認 */}
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 transition hover:border-slate-300">
        <input
          type="checkbox"
          checked={agreedConsent}
          onChange={(e) => onChangeConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-primary accent-primary sm:h-4 sm:w-4"
        />
        <span className="text-sm leading-relaxed text-slate-700">
          入力する情報について、入居候補者ご本人（または正当な代理人）から提供の同意を得ていることを確認します
        </span>
      </label>

      {/* 注意書き */}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        ※
        本フォームでは疾患・ADL等の要配慮個人情報を取り扱います。送信前に必ず上記をご確認ください。
      </p>
    </div>
  );
}
