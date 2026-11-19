"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark" defaultTheme="dark" disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster theme="dark" richColors position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
