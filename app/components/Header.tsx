"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "受入判定" },
  { href: "/booking", label: "内覧予約" },
  { href: "/admin", label: "管理画面" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            居
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-slate-800">
              居室サブリース
            </div>
            <div className="hidden text-[10px] leading-tight text-muted sm:block">
              MSW向け受入判定ポータル
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname === "/result"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
