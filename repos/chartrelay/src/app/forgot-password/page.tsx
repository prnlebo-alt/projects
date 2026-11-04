import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account-forms";
import { emailDeliverable } from "@/lib/email/send";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

/**
 * Read per request, not baked into the build: whether a reset link can be sent is a property of the
 * environment this page is served from, and a locked-out customer must be told before they wait.
 */
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><ForgotPasswordForm emailSendable={emailDeliverable()} /></main>;
}
