"use client";

import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

const fieldBase =
  "w-full rounded-xl bg-white/5 border border-[var(--border)] px-4 py-3 text-fg placeholder:text-fg-subtle transition-all duration-150 focus:border-violet/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet/25";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldBase, "min-h-[100px] resize-y leading-relaxed", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-fg-muted mb-1.5">
      {children}
      {required ? <span className="text-violet ml-0.5">*</span> : null}
    </label>
  );
}
