"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;
export function Tooltip({ content, children, className }: { content: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <T.Root delayDuration={150}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className={cn("z-50 max-w-xs rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md", className)}>
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
