import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account-forms";
import { peekToken } from "@/lib/auth/tokens";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  // Only checks the link; it is consumed when the form is submitted, so email link scanners can't burn it.
  const valid = token ? Boolean(peekToken(token, "reset-password")) : false;
  return <main className="auth-page">{valid ? <ResetPasswordForm token={token!} /> : <div className="auth-card"><span className="eyebrow">Account recovery</span><h1>This link has expired.</h1><p>Reset links work once and expire after an hour.</p><Link className="button button-wide" href="/forgot-password">Request a new link</Link></div>}</main>;
}
