"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Balão de explicação curta. Abre ao passar o mouse, ao focar com o teclado
 * ou ao tocar (celular). Renderizado em portal com posição fixa para não ser
 * cortado por tabelas com rolagem.
 */
export function InfoTip({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);

  const open = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.bottom + 140 > window.innerHeight && r.top > 140;
    setPos({ x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
  }, []);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos, close]);

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-describedby={pos ? id : undefined}
      className={`info-tip ${className}`}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onClick={() => (pos ? close() : open())}
    >
      {children}
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="info-tip__bubble"
            style={{
              left: Math.min(Math.max(pos.x, 150), window.innerWidth - 150),
              top: pos.y,
              transform: `translate(-50%, ${pos.above ? "-100%" : "0"})`,
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
