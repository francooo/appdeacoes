import type { Metadata } from "next";
import { Logo } from "@/components/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Análise de Ações" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Logo size={48} radius={12} />
          <h1 className="page-title mt-1.5">Análise de Ações</h1>
          <p className="text-sm text-muted">Entre para ver o painel diário</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted">
          Acesso restrito. Usuários são criados pelo administrador.
        </p>
      </div>
    </main>
  );
}
