import { z } from "zod";
import { auth } from "@/auth";
import { recordAnswer } from "@/lib/answer";

const Body = z.object({
  cardId: z.uuid(),
  clientAnswerId: z.string().min(8).max(64),
  responseMs: z.number().int().nonnegative(),
  response: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("rating"), rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }),
    z.object({ kind: z.literal("choice"), choice: z.string().max(500) }),
    z.object({ kind: z.literal("text"), text: z.string().max(2000) }),
  ]),
});

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    return Response.json(await recordAnswer({ ...parsed.data, userId: s.user.id, now: new Date() }));
  } catch (e) {
    if (e instanceof Error && e.message === "card not found") return Response.json({ error: "card not found" }, { status: 404 });
    throw e;
  }
}
