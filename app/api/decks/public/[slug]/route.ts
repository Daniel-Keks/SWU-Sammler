import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const row = await env.DB.prepare(`SELECT name, cards_json AS cardsJson FROM saved_decks WHERE public_slug = ?`).bind(slug).first<{ name: string; cardsJson: string }>();
  if (!row) return Response.json({ error: 'Deck nicht gefunden' }, { status: 404 });
  const cards = JSON.parse(row.cardsJson) as Array<{ set: string; number: string; count: number; board: string }>;
  const pick = (board: string) => cards.find((card) => card.board === board);
  return Response.json({ metadata: { name: row.name }, leader: pick('leader') ? { id: `${pick('leader')!.set}_${pick('leader')!.number}`, count: 1 } : null, base: pick('base') ? { id: `${pick('base')!.set}_${pick('base')!.number}`, count: 1 } : null, deck: cards.filter((card) => card.board === 'main').map((card) => ({ id: `${card.set}_${card.number}`, count: card.count })), sideboard: cards.filter((card) => card.board === 'sideboard').map((card) => ({ id: `${card.set}_${card.number}`, count: card.count })) });
}
