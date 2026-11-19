"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Free-text chips (Enter or comma adds). */
export function ChipInput({ value, onChange, placeholder, className, suggestions = [] }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string; suggestions?: string[];
}) {
  const [draft, setDraft] = React.useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  const open = suggestions.filter((s) => !value.includes(s));
  return (
    <div className="space-y-2">
      <div className={cn("flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs focus-within:ring-2 focus-within:ring-ring", className)}>
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
            {v}
            <button type="button" aria-label={`Verwijder ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="hover:text-destructive cursor-pointer"><X className="size-3" /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={value.length ? "" : placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
          className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Uit klantprofiel:</span>
          {open.map((s) => (
            <button key={s} type="button" onClick={() => onChange([...value, s])} className="rounded-md border border-dashed px-2 py-0.5 hover:bg-accent cursor-pointer">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
