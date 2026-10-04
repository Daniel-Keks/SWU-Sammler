import { env } from 'cloudflare:workers';
import { getAppUser } from '@/app/auth';

export const dynamic = 'force-dynamic';

type EntryInput = {
  name?: string;
  subtitle?: string;
  set?: string;
  number?: string;
  rarity?: string;
  color?: string;
  regular?: number;
  foil?: number;
  hyperspace?: number;
  hyperfoil?: number;
  showcase?: number;
};

async function userId() {
  const user = await getAppUser();
  return user?.userId ?? null;
}

function validCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? Math.max(0, value) : 0;
}

export async function GET() {
  const owner = await userId();
  if (!owner) return Response.json({ error: 'Anmeldung erforderlich' }, { status: 401 });
  const result = await env.DB.prepare(`SELECT id, name, subtitle, set_name AS "set", card_number AS number, rarity, color, regular, foil, hyperspace, hyperfoil, showcase FROM collection_entries WHERE user_id = ? ORDER BY set_name, CAST(card_number AS INTEGER), name`).bind(owner).all();
  return Response.json({ cards: result.results });
}

export async function POST(request: Request) {
  const owner = await userId();
  if (!owner) return Response.json({ error: 'Anmeldung erforderlich' }, { status: 401 });
  const body = await request.json() as EntryInput;
  if (!body.name?.trim() || !body.set?.trim() || !body.number?.trim()) return Response.json({ error: 'Name, Set und Nummer sind erforderlich' }, { status: 400 });
  await env.DB.prepare(`INSERT INTO collection_entries (user_id, name, subtitle, set_name, card_number, rarity, color, regular, foil, hyperspace, hyperfoil, showcase, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, set_name, card_number) DO UPDATE SET name = excluded.name, subtitle = excluded.subtitle, rarity = excluded.rarity, color = excluded.color, regular = excluded.regular, foil = excluded.foil, hyperspace = excluded.hyperspace, hyperfoil = excluded.hyperfoil, showcase = excluded.showcase, updated_at = excluded.updated_at`).bind(owner, body.name.trim(), body.subtitle?.trim() ?? '', body.set.trim(), body.number.trim(), body.rarity?.trim() || 'Unbekannt', body.color || '#d6ad43', validCount(body.regular), validCount(body.foil), validCount(body.hyperspace), validCount(body.hyperfoil), validCount(body.showcase), Date.now()).run();
  const row = await env.DB.prepare(`SELECT id, name, subtitle, set_name AS "set", card_number AS number, rarity, color, regular, foil, hyperspace, hyperfoil, showcase FROM collection_entries WHERE user_id = ? AND set_name = ? AND card_number = ?`).bind(owner, body.set.trim(), body.number.trim()).first();
  return Response.json({ card: row }, { status: 201 });
}
