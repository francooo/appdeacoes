"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

export type LoginState = { error?: string };

let dummyHash: string | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Informe e-mail e senha." };

  const user = await findUserByEmail(email);
  // Compara mesmo sem usuário para não revelar quais e-mails existem pelo tempo de resposta.
  dummyHash ??= await bcrypt.hash("dummy-password", 12);
  const ok = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
  if (!user || !ok) return { error: "E-mail ou senha inválidos." };

  const token = await createSessionToken({ userId: user.id, email: user.email, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
