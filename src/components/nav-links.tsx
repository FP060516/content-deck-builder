"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Klanten", match: (p: string) => p === "/" || p.startsWith("/clients") },
  { href: "/decks", label: "Decks", match: (p: string) => p.startsWith("/decks") },
  { href: "/presets", label: "Presets", match: (p: string) => p.startsWith("/presets") },
  { href: "/scraper", label: "Scraper", match: (p: string) => p.startsWith("/scraper") },
];

/** Pill-shaped navigation bar, dark green tint with a subtle border. */
export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="ml-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#04140d]/80 p-1 text-sm backdrop-blur">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href}
          className={cn("rounded-full px-5 py-2 transition-colors", l.match(path) ? "bg-primary/15 text-white" : "text-white/70 hover:text-white")}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
