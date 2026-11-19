import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" }> = {
  draft: { label: "Briefing", variant: "secondary" },
  generating: { label: "Bezig", variant: "warning" },
  review: { label: "Controleren", variant: "default" },
  done: { label: "Klaar", variant: "success" },
};

export function DeckStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? MAP.draft;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
