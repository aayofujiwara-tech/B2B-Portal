import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約・個人情報取扱特約 | ええすまい",
  description:
    "ええすまい 紹介業者・MSW向けポータルサイトの利用規約および個人情報取扱特約",
  robots: "noindex, nofollow",
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
