import type { Metadata } from "next";
import Link from "next/link";
import { Fustat, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { NavLinks } from "@/components/nav-links";
import "./globals.css";

const body = Fustat({ variable: "--font-body", subsets: ["latin"] });
const display = Plus_Jakarta_Sans({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = { title: "Content Deck Builder", description: "Inspiratiedecks uit de Meta Ad Library" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="dark" suppressHydrationWarning>
      <body className={`${body.variable} ${display.variable} font-sans`}>
        <Providers>
          <div className="sc-glow" aria-hidden />
          <header className="sticky top-0 z-40">
            <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-6">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary font-[family-name:var(--font-display)] text-sm font-extrabold text-primary-foreground">CD</span>
                <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-tight">Content Deck <span className="text-primary">Builder</span></span>
              </Link>
              <NavLinks />
            </div>
          </header>
          <main className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
