import Link from "next/link";
import { cn } from "@/lib/utils";

/** Switch between the briefing and the deck of one deck. */
export function DeckTabs({ deckId, active, itemCount }: { deckId: string; active: "briefing" | "deck"; itemCount: number }) {
  const tab = (href: string, label: string, on: boolean, disabled = false) =>
    disabled ? (
      <span className="rounded-full px-4 py-1.5 text-sm text-white/30">{label}</span>
    ) : (
      <Link href={href} className={cn("rounded-full px-4 py-1.5 text-sm transition-colors", on ? "bg-primary text-primary-foreground font-medium" : "text-white/70 hover:text-white")}>{label}</Link>
    );
  return (
    <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
      {tab(`/decks/${deckId}`, "1 · Briefing", active === "briefing")}
      {tab(`/decks/${deckId}/deck`, `2 · Deck${itemCount ? ` (${itemCount})` : ""}`, active === "deck", itemCount === 0)}
    </div>
  );
}
