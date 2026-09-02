type SourceCard = {
  Set: string;
  Number: string;
  Name: string;
  Subtitle?: string;
  Type?: string;
  Rarity?: string;
  VariantType?: string;
  FrontArt?: string;
  BackArt?: string;
  Aspects?: string[];
};

export const revalidate = 21600;

export async function GET(request: Request) {
  const set = new URL(request.url).searchParams.get('set')?.toUpperCase();
  if (!set || !/^[A-Z0-9]{2,8}$/.test(set)) return Response.json({ error: 'Ungültiger Set-Code' }, { status: 400 });
  const response = await fetch(`https://api.swu-db.com/cards/${set.toLowerCase()}`, { headers: { accept: 'application/json' }, next: { revalidate } });
  if (!response.ok) return Response.json({ error: 'Karten konnten nicht geladen werden' }, { status: 502 });
  const payload = await response.json() as { data?: SourceCard[] } | SourceCard[];
  const source = Array.isArray(payload) ? payload : payload.data ?? [];
  const standardCards = source.filter((card) => card.VariantType === 'Normal' || card.VariantType === 'Standard');
  const catalogSource = standardCards.length ? standardCards : source;
  const showcaseByName = new Map(source.filter((card) => card.VariantType === 'Showcase').map((card) => [`${card.Name}|${card.Subtitle ?? ''}`, card]));
  const preferred = new Map<string, SourceCard>();
  for (const card of catalogSource) {
    const current = preferred.get(card.Number);
    if (!current || card.VariantType === 'Normal' || (current.VariantType !== 'Normal' && card.VariantType === 'Standard')) preferred.set(card.Number, card);
  }
  const cards = [...preferred.values()].map((card) => {
    const showcase = showcaseByName.get(`${card.Name}|${card.Subtitle ?? ''}`);
    return ({
    id: `${card.Set}_${card.Number}`,
    set: card.Set,
    number: card.Number,
    name: card.Name,
    subtitle: card.Subtitle ?? '',
    type: card.Type ?? '',
    rarity: card.Rarity ?? 'Unbekannt',
    image: card.FrontArt ?? `https://api.swu-db.com/cards/${card.Set.toLowerCase()}/${card.Number}?format=image`,
    backImage: card.BackArt ?? null,
    aspects: card.Aspects ?? [],
    showcaseImage: showcase?.FrontArt ?? null,
    showcaseNumber: showcase?.Number ?? null,
  });
  }).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  return Response.json({ cards, set, count: cards.length, source: 'SWU-DB' });
}
