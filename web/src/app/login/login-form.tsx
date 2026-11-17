"use client";

import { useActionState } from "react";
import { AlertCircle } from "@/components/icons";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="card flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-medium">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-medium">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>
      {state.error && (
        <div role="alert" className="alert-error">
          <AlertCircle size={16} />
          {state.error}
        </div>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
