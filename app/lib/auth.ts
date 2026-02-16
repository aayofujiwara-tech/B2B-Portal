import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// ---------------------------------------------------------------------------
// 許可ドメイン設定
// Google Workspace の特定ドメインのみ管理画面へのアクセスを許可する。
// 環境変数 ALLOWED_EMAIL_DOMAINS にカンマ区切りで設定するか、
// 未設定の場合はこのデフォルト値が使われる。
// 例: ALLOWED_EMAIL_DOMAINS="company.com,other.com"
// ---------------------------------------------------------------------------
const DEFAULT_ALLOWED_DOMAINS = ["company.com"];

export const ALLOWED_DOMAINS: string[] = process.env.ALLOWED_EMAIL_DOMAINS
  ? process.env.ALLOWED_EMAIL_DOMAINS.split(",").map((d) => d.trim())
  : DEFAULT_ALLOWED_DOMAINS;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const domain = email.split("@")[1];
      return ALLOWED_DOMAINS.includes(domain);
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin-aska-secure-gate-2026",
    error: "/admin-aska-secure-gate-2026",
  },
};
