"use client";
import { cn } from "@/lib/utils";

/** Compact single-choice button group. */
export function Segmented<T extends string | number>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap rounded-full border bg-white/[0.03] p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors cursor-pointer", value === o.value ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
