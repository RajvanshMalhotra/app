"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StudyCard, type SessionCard } from "@/components/study-card";
import { Button } from "@/components/ui/button";

type Item = { kind: "review" | "new" | "drill"; card: SessionCard };

export function SessionClient() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetch(`/api/session?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { setItems(d.items); setI(0); })
      .catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div role="alert" className="py-20">
        <p className="text-lg">Today&apos;s session didn&apos;t load.</p>
        <p className="mt-1 text-muted-foreground">Check your connection, then try again.</p>
        <Button className="mt-6 h-11" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!items) return <div aria-busy className="sheet h-96 animate-pulse rounded-2xl border" />;

  if (i >= items.length) {
    return (
      <div data-testid="done" className="py-20">
        <h2 className="font-prompt text-3xl font-semibold tracking-tight">
          {items.length ? "That's today done." : "Nothing due today."}
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          {items.length
            ? `You worked through ${items.length} ${items.length === 1 ? "card" : "cards"}. The ones you found hard will come back sooner.`
            : "You're up to date. New cards will be ready tomorrow."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div role="progressbar" data-testid="progress" aria-label="Session progress" aria-valuemin={0} aria-valuenow={i} aria-valuemax={items.length}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full bg-pen" initial={false} animate={{ width: `${(i / items.length) * 100}%` }} />
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{i + 1}/{items.length}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={items[i].card.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}>
          <StudyCard card={items[i].card} kind={items[i].kind} onDone={() => setI((x) => x + 1)} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
