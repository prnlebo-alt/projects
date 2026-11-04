import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentAccount } from "@/lib/auth/session";
import { emailDeliverable } from "@/lib/email/send";
import { planLimits, UNVERIFIED_FREE_LIMIT } from "@/lib/usage/plans";

export const metadata: Metadata = { title: "Create account", alternates: { canonical: "/register" } };
export default async function RegisterPage() {
  if (await currentAccount()) redirect("/dashboard");
  return <main className="auth-page"><AuthForm mode="register" freeLimit={planLimits.free} unverifiedLimit={UNVERIFIED_FREE_LIMIT} emailSendable={emailDeliverable()} /></main>;
}
