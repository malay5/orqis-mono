"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function RatingStars({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        return (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(
              filled ? "text-violet fill-violet" : half ? "text-violet" : "text-fg-subtle",
              "transition-colors"
            )}
            strokeWidth={filled || half ? 1.6 : 1.5}
          />
        );
      })}
    </span>
  );
}

export function RatingPicker({
  value,
  onChange,
  size = 28,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => {
        const active = value >= i;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            disabled={disabled}
            onClick={() => onChange(i)}
            className="rounded-md p-1 transition-transform hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Star
              width={size}
              height={size}
              className={cn(
                active ? "text-violet fill-violet" : "text-fg-subtle hover:text-violet/80",
                "transition-colors"
              )}
              strokeWidth={1.6}
            />
          </button>
        );
      })}
    </div>
  );
}
