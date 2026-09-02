type DeckLine = {
  set: string;
  number: string;
  name: string;
  count: number;
  board: 'leader' | 'base' | 'main' | 'sideboard';
};

type SwuDbEntry = { id?: string; count?: number };
type SwuDbDeck = {
  metadata?: { name?: string };
  leader?: SwuDbEntry | null;
  secondleader?: SwuDbEntry | null;
  base?: SwuDbEntry | null;
  deck?: SwuDbEntry[];
  sideboard?: SwuDbEntry[];
};

type SwuBaseDeckCard = { cardId?: string; board?: number; quantity?: number };
type SwuBaseCard = {
  name?: string;
  set?: string;
  variants?: Record<string, {
    set?: string;
    cardNo?: number;
    baseSet?: boolean;
    variantName?: string;
  }>;
};

export const revalidate = 21600;

function cardNumber(value: string | number) {
  return String(value).padStart(3, '0');
}

function addLine(target: Map<string, DeckLine>, line: DeckLine) {
  const key = `${line.board}:${line.set}:${line.number}`;
  const current = target.get(key);
  target.set(key, current ? { ...current, count: Math.max(current.count, line.count) } : line);
}

function swuDbLine(entry: SwuDbEntry | null | undefined, board: DeckLine['board']) {
  const match = entry?.id?.toUpperCase().match(/^([A-Z0-9]{2,8})[_-](\d+)$/);
  if (!match) return null;
  return {
    set: match[1],
    number: cardNumber(match[2]),
    name: entry?.id ?? `${match[1]} ${match[2]}`,
    count: Math.max(1, Number(entry?.count) || 1),
    board,
  } satisfies DeckLine;
}

async function importSwuDb(deckId: string) {
  const response = await fetch(`https://swudb.com/api/getDeckJson/${encodeURIComponent(deckId)}`, {
    headers: { accept: 'application/json' },
    next: { revalidate },
  });
  if (!response.ok) throw new Error('Dieses SWUDB-Deck ist nicht öffentlich erreichbar.');
  const deck = await response.json() as SwuDbDeck;
  const lines = new Map<string, DeckLine>();
  for (const [entry, board] of [[deck.leader, 'leader'], [deck.secondleader, 'leader'], [deck.base, 'base']] as const) {
    const line = swuDbLine(entry, board);
    if (line) addLine(lines, line);
  }
  for (const entry of deck.deck ?? []) {
    const line = swuDbLine(entry, 'main');
    if (line) addLine(lines, line);
  }
  for (const entry of deck.sideboard ?? []) {
    const line = swuDbLine(entry, 'sideboard');
    if (line) addLine(lines, line);
  }
  if (!lines.size) throw new Error('In diesem SWUDB-Deck wurden keine Karten gefunden.');
  const hydrated = await Promise.all([...lines.values()].map(async (line) => {
    try {
      const cardResponse = await fetch(`https://api.swu-db.com/cards/${line.set.toLowerCase()}/${Number.parseInt(line.number, 10)}`, { headers: { accept: 'application/json' }, next: { revalidate } });
      if (!cardResponse.ok) return line;
      const card = await cardResponse.json() as { Name?: string; Subtitle?: string };
      return { ...line, name: card.Name ? `${card.Name}${card.Subtitle ? `, ${card.Subtitle}` : ''}` : line.name };
    } catch { return line; }
  }));
  return { source: 'SWUDB', name: deck.metadata?.name?.trim() || 'SWUDB-Deck', cards: hydrated };
}

async function importSwuBase(deckId: string) {
  const [deckResponse, contentResponse, cardsResponse] = await Promise.all([
    fetch(`https://swubase.com/api/deck/${encodeURIComponent(deckId)}`, { headers: { accept: 'application/json' }, next: { revalidate } }),
    fetch(`https://swubase.com/api/deck/${encodeURIComponent(deckId)}/card`, { headers: { accept: 'application/json' }, next: { revalidate } }),
    fetch('https://swubase.com/api/cards', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: '{}', next: { revalidate } }),
  ]);
  if (!deckResponse.ok || !contentResponse.ok || !cardsResponse.ok) throw new Error('Dieses SWUBase-Deck ist nicht öffentlich erreichbar.');
  const deckPayload = await deckResponse.json() as { deck?: { name?: string; leaderCardId1?: string | null; leaderCardId2?: string | null; baseCardId?: string | null } };
  const contentPayload = await contentResponse.json() as { data?: SwuBaseDeckCard[] };
  const cardsPayload = await cardsResponse.json() as { official?: { cards?: Record<string, SwuBaseCard> }; preview?: { cards?: Record<string, SwuBaseCard> } };
  const cards = { ...(cardsPayload.preview?.cards ?? {}), ...(cardsPayload.official?.cards ?? {}) };
  const lines = new Map<string, DeckLine>();

  const resolve = (cardId: string | null | undefined, count: number, board: DeckLine['board']) => {
    if (!cardId) return;
    const card = cards[cardId];
    const variants = Object.values(card?.variants ?? {});
    const variant = variants.find((item) => item.baseSet && item.variantName?.toLowerCase() === 'standard')
      ?? variants.find((item) => item.variantName?.toLowerCase() === 'standard')
      ?? variants[0];
    if (!card || !variant?.set || variant.cardNo == null) return;
    addLine(lines, { set: variant.set.toUpperCase(), number: cardNumber(variant.cardNo), name: card.name ?? cardId, count: Math.max(1, count), board });
  };

  resolve(deckPayload.deck?.leaderCardId1, 1, 'leader');
  resolve(deckPayload.deck?.leaderCardId2, 1, 'leader');
  resolve(deckPayload.deck?.baseCardId, 1, 'base');
  for (const entry of contentPayload.data ?? []) resolve(entry.cardId, Number(entry.quantity) || 1, entry.board === 2 ? 'sideboard' : 'main');
  if (!lines.size) throw new Error('In diesem SWUBase-Deck wurden keine Karten gefunden.');
  return { source: 'SWUBase', name: deckPayload.deck?.name?.trim() || 'SWUBase-Deck', cards: [...lines.values()] };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    const value = body.url?.trim();
    if (!value) return Response.json({ error: 'Bitte füge einen Decklink ein.' }, { status: 400 });
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const deckIndex = parts.findIndex((part) => part === 'deck' || part === 'decks');
    const deckId = deckIndex >= 0 ? parts[deckIndex + 1] : null;
    if (!deckId) return Response.json({ error: 'Im Link wurde keine Deck-ID gefunden.' }, { status: 400 });
    if (url.hostname === 'swudb.com' || url.hostname === 'www.swudb.com') return Response.json(await importSwuDb(deckId));
    if (url.hostname === 'swubase.com' || url.hostname === 'www.swubase.com') return Response.json(await importSwuBase(deckId));
    return Response.json({ error: 'Bitte verwende einen Link von SWUDB.com oder SWUBase.com.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Das Deck konnte nicht geladen werden.';
    return Response.json({ error: message }, { status: message.startsWith('Dieses') ? 502 : 400 });
  }
}
