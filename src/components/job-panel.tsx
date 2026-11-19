"use client";
import * as React from "react";
import { CircleAlert, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { JobView } from "@/lib/jobs/queue";
import { cn } from "@/lib/utils";

export const isActive = (j: JobView | null) => !!j && (j.status === "queued" || j.status === "running");

export const queuedJob = (id: string, type: string): JobView => ({
  id, type, status: "queued", progress: 0, message: "In de wachtrij…", log: [], result: {}, error: "", createdAt: new Date().toISOString(), finishedAt: null,
});

/** Keeps a job in sync via Server-Sent Events while it is queued or running. */
export function useJob(initial: JobView | null, onFinished?: (j: JobView) => void) {
  const [job, setJob] = React.useState<JobView | null>(initial);
  const done = React.useRef(onFinished);
  done.current = onFinished;
  const active = isActive(job);
  React.useEffect(() => {
    if (!job || !active) return;
    const es = new EventSource(`/api/jobs/${job.id}/events`);
    es.addEventListener("job", (e) => {
      const next = JSON.parse((e as MessageEvent).data) as JobView;
      setJob(next);
      if (!isActive(next)) { es.close(); done.current?.(next); }
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [job?.id, active]); // eslint-disable-line react-hooks/exhaustive-deps
  return [job, setJob] as const;
}

export function JobPanel({ job, onCancel, doneLabel = "Klaar" }: { job: JobView; onCancel?: () => void; doneLabel?: string }) {
  const active = isActive(job);
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{active ? job.message || "Bezig…" : job.status === "done" ? doneLabel : job.status === "cancelled" ? "Geannuleerd" : "Mislukt"}</p>
          {active && onCancel && <Button variant="outline" size="sm" onClick={onCancel}><Square /> Stoppen</Button>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full rounded-full transition-all", job.status === "failed" ? "bg-destructive" : "bg-primary")} style={{ width: `${job.status === "done" ? 100 : job.progress}%` }} />
        </div>
        {job.status === "failed" && (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />{job.error || "Onbekende fout"}</p>
        )}
        {job.log.length > 0 && (
          <details className="text-xs text-muted-foreground" open={active}>
            <summary className="cursor-pointer select-none">Logboek ({job.log.length})</summary>
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto font-mono">
              {job.log.map((l, i) => (
                <li key={i} className={cn(l.level === "warn" && "text-warning", l.level === "error" && "text-destructive")}>
                  {new Date(l.t).toLocaleTimeString("nl-NL")} · {l.msg}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
