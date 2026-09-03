import { cn } from "@/lib/cn";

export function LogoMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="orqis mark"
    >
      <defs>
        <linearGradient
          id={`orqis-mark-grad-${size}`}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <circle
        cx="14"
        cy="18"
        r="9"
        fill="none"
        stroke={`url(#orqis-mark-grad-${size})`}
        strokeWidth="3"
      />
      <circle cx="24" cy="8" r="4" fill="#06b6d4" />
    </svg>
  );
}

export function Logo({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span
        className="font-semibold tracking-tight text-fg"
        style={{ fontSize: size * 0.72 }}
      >
        orqis
      </span>
    </span>
  );
}
