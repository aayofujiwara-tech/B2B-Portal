import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "居室サブリース | MSW向け 受入判定ポータル",
  description:
    "病院MSW向け：24時間いつでも即決判定・内覧予約ができるB2Bポータル",
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
