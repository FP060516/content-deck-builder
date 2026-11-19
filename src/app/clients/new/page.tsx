import { ClientForm } from "../client-form";
import { EMPTY_CLIENT } from "@/lib/client-profile";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="sc-heading text-3xl font-semibold tracking-tight md:text-4xl">Nieuwe klant</h1>
        <p className="text-sm text-muted-foreground">Vul naam, website en pagina-naam in en klik op “Analyseren”: de tool leest de site en eigen ads, en Claude stelt het profiel en de gat-analyse voor.</p>
      </div>
      <ClientForm id={null} initial={EMPTY_CLIENT} />
    </div>
  );
}
