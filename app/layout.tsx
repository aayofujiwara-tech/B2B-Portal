import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ええすまい | 紹介業者、MSW向けポータルサイト",
  description:
    "紹介業者・MSW向け：24時間いつでも即決判定・面談予約ができるええすまいポータル",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
