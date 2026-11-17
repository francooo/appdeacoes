import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Análise de Ações" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">
            📈
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Análise de Ações</h1>
          <p className="mt-1 text-sm text-muted">Entre para ver o painel diário</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
