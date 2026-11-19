"use client";
import * as React from "react";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export function PopoverContent({ className, align = "start", sideOffset = 4, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn("z-50 rounded-2xl border bg-popover text-popover-foreground shadow-lg outline-none", className)} {...props} />
    </P.Portal>
  );
}
