"use client";
import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { OptionGroup } from "@/lib/briefing/options";
import { cn } from "@/lib/utils";

type Base = { groups: OptionGroup[]; placeholder?: string; searchPlaceholder?: string; className?: string; disabled?: boolean };
type Multi = Base & { multiple: true; value: string[]; onChange: (v: string[]) => void };
type Single = Base & { multiple?: false; value: string | undefined; onChange: (v: string) => void };

/** Dropdown bar: click → searchable, grouped list. Multi-select shows a checklist and chips. */
export function OptionPicker(props: Multi | Single) {
  const { groups, placeholder = "Kies…", searchPlaceholder = "Zoeken…", className, disabled } = props;
  const [open, setOpen] = React.useState(false);
  const all = groups.flatMap((g) => g.options);
  const labelOf = (v: string) => all.find((o) => o.value === v)?.label ?? v;
  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const showGroupHeadings = groups.length > 1 || !!groups[0]?.label;

  const toggle = (v: string) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" className={cn(
          "flex min-h-10 w-full items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-left text-sm shadow-xs transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 cursor-pointer",
          className,
        )}>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            {!props.multiple && selected[0] && <span>{labelOf(selected[0])}</span>}
            {props.multiple && selected.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {labelOf(v)}
                <span role="button" tabIndex={-1} aria-label={`Verwijder ${labelOf(v)}`} className="rounded-sm hover:bg-primary/20"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(v); }}>
                  <X className="size-3" />
                </span>
              </span>
            ))}
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Niets gevonden.</CommandEmpty>
            {groups.map((g, i) => (
              <CommandGroup key={g.label + i} heading={showGroupHeadings ? g.label : undefined}>
                {g.options.map((o) => {
                  const isSel = selected.includes(o.value);
                  return (
                    <CommandItem key={o.value} value={`${o.label} ${g.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                      <span className={cn("flex size-4 shrink-0 items-center justify-center border", props.multiple ? "rounded-sm" : "rounded-full",
                        isSel ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                        {isSel && <Check className="size-3" />}
                      </span>
                      <div className="flex flex-col">
                        <span>{o.label}</span>
                        {o.description && <span className="text-xs text-muted-foreground">{o.description}</span>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {props.multiple && selected.length > 0 && (
            <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
              <span>{selected.length} geselecteerd</span>
              <button type="button" className="hover:text-foreground cursor-pointer" onClick={() => props.onChange([])}>Wis alles</button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
