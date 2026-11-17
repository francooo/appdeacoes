import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Verificação otimista (só o cookie). As páginas verificam de novo com requireUser().
export default async function proxy(req: NextRequest) {
  const isLogin = req.nextUrl.pathname === "/login";
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
