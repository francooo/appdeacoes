import Link from "next/link";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Painel" },
  { href: "/swing", label: "Swing Trade" },
];

export function Header({ userName, active }: { userName: string; active?: "/" | "/swing" }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-lg">📈</span> <span className="hidden sm:inline">Análise de Ações</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 transition hover:bg-surface-2 ${
                  active === n.href ? "bg-surface-2 font-medium" : "text-muted"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-muted md:inline">{userName}</span>
          <form action={logout}>
            <button className="rounded-lg border border-line px-3 py-1.5 transition hover:bg-surface-2">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
