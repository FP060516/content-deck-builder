"use client";
import * as React from "react";
import { Command as C } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Command = ({ className, ...p }: React.ComponentProps<typeof C>) => <C className={cn("flex h-full w-full flex-col overflow-hidden rounded-lg", className)} {...p} />;
export const CommandInput = ({ className, ...p }: React.ComponentProps<typeof C.Input>) => (
  <div className="flex items-center gap-2 border-b px-3">
    <Search className="size-4 text-muted-foreground" />
    <C.Input className={cn("flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)} {...p} />
  </div>
);
export const CommandList = ({ className, ...p }: React.ComponentProps<typeof C.List>) => <C.List className={cn("max-h-80 overflow-y-auto overflow-x-hidden p-1", className)} {...p} />;
export const CommandEmpty = (p: React.ComponentProps<typeof C.Empty>) => <C.Empty className="py-6 text-center text-sm text-muted-foreground" {...p} />;
export const CommandGroup = ({ className, ...p }: React.ComponentProps<typeof C.Group>) => (
  <C.Group className={cn("overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground", className)} {...p} />
);
export const CommandItem = ({ className, ...p }: React.ComponentProps<typeof C.Item>) => (
  <C.Item className={cn("relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50", className)} {...p} />
);
export const CommandSeparator = (p: React.ComponentProps<typeof C.Separator>) => <C.Separator className="-mx-1 h-px bg-border" {...p} />;
