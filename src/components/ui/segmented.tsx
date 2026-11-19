"use client";
import { cn } from "@/lib/utils";

/** Compact single-choice button group. */
export function Segmented<T extends string | number>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap rounded-lg border bg-secondary/50 p-0.5", className)} role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer", value === o.value ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
