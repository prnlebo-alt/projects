import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentAccount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", alternates: { canonical: "/login" } };
export default async function LoginPage() {
  if (await currentAccount()) redirect("/dashboard");
  return <main className="auth-page"><AuthForm mode="login" /></main>;
}
