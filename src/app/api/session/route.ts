import { auth } from "@/auth";
import { buildDailySession } from "@/lib/session";
import { shuffled } from "@/lib/shuffle";
import { startOfDay } from "@/lib/day";

export async function GET(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const tz = new URL(req.url).searchParams.get("tz") ?? "UTC";
  const items = await buildDailySession(s.user.id, now, { dayStart: startOfDay(now, tz) });
  return Response.json({
    items: items.map(({ kind, card }) => ({
      kind,
      card: { id: card.id, type: card.type, prompt: card.prompt, choices: card.choices && shuffled(card.choices), answer: card.answer, citation: card.citation },
    })),
  });
}
