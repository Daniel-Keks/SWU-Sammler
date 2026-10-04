import { env } from 'cloudflare:workers';
import { getAppUser } from '@/app/auth';

export const dynamic = 'force-dynamic';

async function ownerId() { return (await getAppUser())?.userId ?? null; }

export async function GET() {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: 'Anmeldung erforderlich' }, { status: 401 });
  const rows = await env.DB.prepare(`SELECT id, name, source, source_url AS sourceUrl, cards_json AS cardsJson, public_slug AS publicSlug, updated_at AS updatedAt FROM saved_decks WHERE user_id = ? ORDER BY updated_at DESC`).bind(owner).all();
  return Response.json({ decks: rows.results.map((row) => ({ ...row, cards: JSON.parse(String(row.cardsJson)), cardsJson: undefined })) });
}

export async function POST(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: 'Anmeldung erforderlich' }, { status: 401 });
  const body = await request.json() as { id?: string; name?: string; source?: string; sourceUrl?: string; cards?: unknown[] };
  if (!body.name?.trim() || !Array.isArray(body.cards)) return Response.json({ error: 'Deckname und Karten sind erforderlich' }, { status: 400 });
  const id = body.id || crypto.randomUUID();
  const existing = await env.DB.prepare(`SELECT public_slug FROM saved_decks WHERE id = ? AND user_id = ?`).bind(id, owner).first<{ public_slug: string }>();
  const slug = existing?.public_slug || crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO saved_decks (id, user_id, name, source, source_url, cards_json, public_slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, source=excluded.source, source_url=excluded.source_url, cards_json=excluded.cards_json, updated_at=excluded.updated_at WHERE user_id=excluded.user_id`).bind(id, owner, body.name.trim(), body.source || 'SWU Sammler', body.sourceUrl || '', JSON.stringify(body.cards), slug, now, now).run();
  return Response.json({ deck: { id, name: body.name.trim(), source: body.source || 'SWU Sammler', sourceUrl: body.sourceUrl || '', cards: body.cards, publicSlug: slug, updatedAt: now } });
}

export async function DELETE(request: Request) {
  const owner = await ownerId();
  if (!owner) return Response.json({ error: 'Anmeldung erforderlich' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Deck-ID fehlt' }, { status: 400 });
  await env.DB.prepare(`DELETE FROM saved_decks WHERE id = ? AND user_id = ?`).bind(id, owner).run();
  return Response.json({ ok: true });
}
