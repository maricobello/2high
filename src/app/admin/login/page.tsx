import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Acesso administrativo", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <div className="glow absolute inset-0" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
