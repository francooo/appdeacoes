import Link from "next/link";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/icons";

const NAV = [
  { href: "/", label: "Painel" },
  { href: "/swing", label: "Swing Trade" },
] as const;

export function Header({ userName, active }: { userName: string; active?: "/" | "/swing" }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold">
          <Logo size={32} radius={8} />
          Análise de Ações
        </Link>
        <nav aria-label="Principal" className="flex gap-1">
          {NAV.map((n) => {
            const isActive = active === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-surface-2 ${
                  isActive ? "bg-surface-2 font-semibold" : "text-muted"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[13px] text-muted">{userName}</span>
          <form action={logout}>
            <button className="btn-ghost">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
