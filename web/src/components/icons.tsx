import type { ReactNode, SVGProps } from "react";

/** Ícones do design system (docs/design/icones): 24×24, traço 2, herdam a cor do texto. */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; strokeWidth?: number };

function Icon({ size = 16, strokeWidth = 2, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TrendUp = (p: IconProps) => (
  <Icon {...p}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></Icon>
);
export const TrendDown = (p: IconProps) => (
  <Icon {...p}><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></Icon>
);
export const TrendFlat = (p: IconProps) => (
  <Icon {...p}><line x1="3" y1="12" x2="21" y2="12" /><polyline points="17 8 21 12 17 16" /></Icon>
);
export const ChartLine = (p: IconProps) => (
  <Icon {...p}><path d="M3 3v18h18" /><polyline points="7 14 11 10 14 13 20 7" /></Icon>
);
export const Target = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icon>
);
export const Shield = (p: IconProps) => (
  <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>
);
export const News = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4h13v16H6a2 2 0 0 1-2-2z" /><path d="M17 8h3v10a2 2 0 0 1-2 2" />
    <line x1="8" y1="8" x2="13" y2="8" /><line x1="8" y1="12" x2="13" y2="12" /><line x1="8" y1="16" x2="11" y2="16" />
  </Icon>
);
export const Sparkles = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </Icon>
);
export const AlertCircle = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>
);
export const AlertTriangle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </Icon>
);
export const Check = (p: IconProps) => <Icon {...p}><polyline points="20 6 9 17 4 12" /></Icon>;
export const X = (p: IconProps) => (
  <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>
);
export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Icon>
);
export const ChevronDown = (p: IconProps) => <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>;
export const ChevronRight = (p: IconProps) => <Icon {...p}><polyline points="9 18 15 12 9 6" /></Icon>;
export const Refresh = (p: IconProps) => (
  <Icon {...p}><polyline points="23 4 23 10 17 10" /><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" /></Icon>
);
export const User = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>
);
export const LogOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </Icon>
);

/** Marca: quadrado verde com a linha de tendência. */
export function Logo({ size = 32, radius }: { size?: number; radius?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-brand text-white"
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size / 4) }}
      aria-hidden
    >
      <TrendUp size={Math.round(size * 0.56)} strokeWidth={2.2} />
    </span>
  );
}
