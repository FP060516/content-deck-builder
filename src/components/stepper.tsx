"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({ value, onChange, min = 0, max = 10, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className={cn("inline-flex items-center rounded-lg border bg-card shadow-xs", value === 0 && "opacity-60")} aria-label={label}>
      <button type="button" aria-label="Minder" disabled={value <= min} onClick={() => set(value - 1)} className="flex size-8 items-center justify-center rounded-l-lg hover:bg-accent disabled:opacity-30 cursor-pointer"><Minus className="size-3.5" /></button>
      <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value) || 0)}
        className="h-8 w-10 border-x bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" aria-label="Meer" disabled={value >= max} onClick={() => set(value + 1)} className="flex size-8 items-center justify-center rounded-r-lg hover:bg-accent disabled:opacity-30 cursor-pointer"><Plus className="size-3.5" /></button>
    </div>
  );
}
