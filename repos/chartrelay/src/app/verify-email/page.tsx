import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmail } from "@/lib/auth/account";
import { planLimits } from "@/lib/usage/plans";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? verifyEmail(token) : false;
  return <main className="auth-page"><div className="auth-card"><span className="eyebrow">Email confirmation</span>
    {ok ? <><h1>Email confirmed.</h1><p>Your free limit is now {planLimits.free.toLocaleString("en-US")} renders a month.</p><Link className="button button-wide" href="/dashboard">Open dashboard</Link></>
      : <><h1>This link didn&apos;t work.</h1><p>It may have expired or already been used. If your email is already confirmed, you&apos;re all set; otherwise, send a new link from your dashboard.</p><Link className="button button-wide" href="/dashboard">Open dashboard</Link></>}
  </div></main>;
}
