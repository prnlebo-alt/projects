import Link from "next/link";
import { currentAccount } from "@/lib/auth/session";

export async function Header() {
  const account = await currentAccount();
  return <header className="site-header">
    <Link href="/" className="brand" aria-label="ChartRelay home"><span className="brand-mark">CR</span><span>ChartRelay</span></Link>
    <nav aria-label="Primary navigation">
      <Link href="/playground">Playground</Link>
      <Link href="/docs">Docs</Link>
      <Link href="/pricing">Pricing</Link>
      {account ? <Link className="button button-small" href="/dashboard">Dashboard</Link> : <><Link href="/login">Sign in</Link><Link className="button button-small" href="/register">Start free</Link></>}
    </nav>
  </header>;
}
