import { ClientForm } from "../client-form";
import { EMPTY_CLIENT } from "@/lib/client-profile";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nieuwe klant</h1>
        <p className="text-sm text-muted-foreground">Vul het profiel nu met de hand in. In fase 3 crawlt de tool de site en stelt Claude het profiel en de gat-analyse voor.</p>
      </div>
      <ClientForm id={null} initial={EMPTY_CLIENT} />
    </div>
  );
}
