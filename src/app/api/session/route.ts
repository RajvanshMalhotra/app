import { auth } from "@/auth";
import { buildDailySession } from "@/lib/session";
import { shuffled } from "@/lib/shuffle";

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = await buildDailySession(s.user.id, new Date());
  return Response.json({
    items: items.map(({ kind, card }) => ({
      kind,
      card: { id: card.id, type: card.type, prompt: card.prompt, choices: card.choices && shuffled(card.choices), answer: card.answer, citation: card.citation },
    })),
  });
}
