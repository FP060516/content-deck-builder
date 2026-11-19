import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Layers } from "lucide-react";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Content Deck Builder", description: "Inspiratiedecks uit de Meta Ad Library" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <Providers>
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Layers className="size-4" /></span>
                Content Deck Builder
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground">Klanten</Link>
                <Link href="/decks" className="hover:text-foreground">Decks</Link>
                <Link href="/presets" className="hover:text-foreground">Presets</Link>
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
