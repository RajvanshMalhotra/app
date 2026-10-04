"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { RichText } from "./math";
import { Button } from "./ui/button";

export type SessionCard = {
  id: string; type: "flashcard" | "mcq" | "free_text" | "math"; prompt: string;
  answer: string; choices: string[] | null; citation: string | null;
};
type Result = { status: "graded"; correct: boolean; feedback?: string } | { status: "self_rate"; reason: string };

const RATINGS = [["Again", 1], ["Hard", 2], ["Good", 3], ["Easy", 4]] as const;
const KIND_LABEL: Record<string, string> = { review: "Review", new: "New", drill: "Weak spot" };

function MarginMark({ correct }: { correct: boolean }) {
  const Icon = correct ? Check : X;
  return (
    <motion.span
      aria-hidden
      initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      className={`absolute left-2 top-6 md:left-4 ${correct ? "text-mark-right" : "text-mark-wrong"}`}
    >
      <Icon className="size-7 md:size-8" strokeWidth={3} />
    </motion.span>
  );
}

export function StudyCard({ card, kind, onDone: advance }: { card: SessionCard; kind: string; onDone: () => void }) {
  // The card animates out after advancing, so guard against a second advance
  // (e.g. a keyboard shortcut and a focused button both handling the same Enter).
  const done = useRef(false);
  const onDone = () => {
    if (done.current) return;
    done.current = true;
    advance();
  };
  const [flipped, setFlipped] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [started] = useState(() => Date.now());
  const answerId = useRef("");

  async function send(response: object, fresh = false) {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (fresh || !answerId.current) answerId.current = crypto.randomUUID();
    try {
      const r = await fetch("/api/answer", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, clientAnswerId: answerId.current, response, responseMs: Date.now() - started }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const data: Result = await r.json();
      if (card.type === "flashcard" || fresh) onDone();
      else setResult(data);
    } catch {
      setError("Your answer wasn't saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // A focused button already activates on Enter/Space; handling them here too would act twice.
      if (tag === "BUTTON" && (e.key === "Enter" || e.code === "Space")) return;
      if (card.type === "flashcard" && !flipped && e.code === "Space") { e.preventDefault(); setFlipped(true); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && ((card.type === "flashcard" && flipped) || result?.status === "self_rate"))
        send({ kind: "rating", rating: n }, result?.status === "self_rate");
      if (e.key === "Enter" && result?.status === "graded") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ratingRow = (fresh: boolean) => (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map(([label, n]) => (
        <Button key={n} data-testid={`rate-${n}`} variant={n === 3 ? "default" : "outline"} className="h-12 text-sm" disabled={busy}
          onClick={() => send({ kind: "rating", rating: n }, fresh)}>
          {label}<span className="ml-1.5 hidden text-xs opacity-60 lg:inline">{n}</span>
        </Button>
      ))}
    </div>
  );

  const graded = result?.status === "graded" ? result : null;

  return (
    <article className="sheet relative overflow-hidden rounded-2xl border shadow-[0_1px_0_var(--border),0_12px_32px_-18px_rgb(27_34_48/0.35)]">
      {graded && <MarginMark correct={graded.correct} />}
      <div className="py-7 pl-14 pr-5 md:py-10 md:pl-20 md:pr-10">
        <p className="mb-4 text-xs font-medium text-muted-foreground">{KIND_LABEL[kind] ?? kind}</p>
        <p data-testid="prompt" className="font-prompt text-[1.375rem] leading-[1.55] md:text-[1.625rem]">
          <RichText text={card.prompt} />
        </p>

        <div className="mt-8 space-y-4">
          {card.type === "flashcard" && !flipped && (
            <Button data-testid="flip" className="h-12 w-full" onClick={() => setFlipped(true)}>
              Show answer<span className="ml-2 hidden text-xs opacity-70 lg:inline">Space</span>
            </Button>
          )}
          {card.type === "flashcard" && flipped && (
            <>
              <div className="rounded-xl border bg-card/90 p-4 text-lg"><RichText text={card.answer} /></div>
              <p className="text-sm text-muted-foreground">How well did you know it?</p>
              {ratingRow(false)}
            </>
          )}

          {card.type === "mcq" && !result && (
            <div className="grid gap-2">
              {card.choices?.map((c, i) => (
                <Button key={c} data-testid={`choice-${i}`} variant="outline" disabled={busy}
                  className="h-auto min-h-12 w-full justify-start whitespace-normal bg-card/90 py-3 text-left text-base"
                  onClick={() => send({ kind: "choice", choice: c })}>
                  <RichText text={c} />
                </Button>
              ))}
            </div>
          )}

          {(card.type === "math" || card.type === "free_text") && !result && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ kind: "text", text }); }}>
              {card.type === "math" ? (
                <input data-testid="math-input" aria-label="Your answer" autoFocus value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. 3x^2 + 2" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                  className="h-12 w-full rounded-xl border bg-card px-4 font-mono text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              ) : (
                <textarea data-testid="math-input" aria-label="Your answer" value={text} onChange={(e) => setText(e.target.value)} rows={4}
                  className="w-full rounded-xl border bg-card p-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              )}
              {card.type === "math" && text.trim() && (
                <p className="min-h-6 text-muted-foreground" aria-live="polite"><RichText text={`$${text}$`} /></p>
              )}
              <Button type="submit" data-testid="submit" className="h-12 w-full" disabled={busy || !text.trim()}>Check answer</Button>
            </form>
          )}

          {error && <p role="alert" className="text-sm text-mark-wrong">{error}</p>}

          {result && (
            <div data-testid="result" className="space-y-4">
              {graded ? (
                <p className={`font-medium ${graded.correct ? "text-mark-right" : "text-mark-wrong"}`}>
                  {graded.correct ? "Correct" : "Not quite"}{graded.feedback ? `. ${graded.feedback}` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">{result.status === "self_rate" && result.reason}</p>
              )}
              <div className="rounded-xl border bg-card/90 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Answer</p>
                <div className="text-lg"><RichText text={card.answer} /></div>
                {card.citation && <p className="mt-2 text-xs text-muted-foreground">{card.citation}</p>}
              </div>
              {graded ? (
                <Button className="h-12 w-full" onClick={onDone} autoFocus>
                  Next card<span className="ml-2 hidden text-xs opacity-70 lg:inline">Enter</span>
                </Button>
              ) : ratingRow(true)}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
