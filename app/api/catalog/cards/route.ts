import { emptyMarketPrices, getCardmarketPrices } from '../cardmarket';

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

type OfficialCard = {
  attributes: {
    title: string;
    subtitle?: string | null;
    cardNumber: number;
    cardCount?: number;
    expansion?: { data?: { attributes?: { name?: string; code?: string } } };
    variantOf?: { data?: { attributes?: { cardNumber?: number } } };
    artFront?: { data?: { attributes?: { url?: string; formats?: { card?: { url?: string } } } } };
    artBack?: { data?: { attributes?: { url?: string; formats?: { card?: { url?: string } } } } };
  };
};

type OfficialResponse = {
  data?: OfficialCard[];
  meta?: { pagination?: { pageCount?: number } };
};

export const revalidate = 21600;

function officialImage(card?: OfficialCard, side: 'artFront' | 'artBack' = 'artFront') {
  const art = card?.attributes[side]?.data?.attributes;
  return art?.formats?.card?.url ?? art?.url ?? null;
}

async function fetchOfficialCards(set: string, language: 'de' | 'en', filter: string) {
  const base = new URL('https://admin.starwarsunlimited.com/api/card-list');
  base.searchParams.set('locale', language);
  base.searchParams.set('filters[expansion][code][$eq]', set);
  base.searchParams.set(filter, 'true');
  base.searchParams.set('pagination[pageSize]', '250');
  const load = async (page: number) => {
    const url = new URL(base);
    url.searchParams.set('pagination[page]', String(page));
    const response = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate } });
    if (!response.ok) throw new Error('Official card catalog unavailable');
    return response.json() as Promise<OfficialResponse>;
  };
  const first = await load(1);
  const pageCount = first.meta?.pagination?.pageCount ?? 1;
  const remaining = pageCount > 1 ? await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => load(index + 2))) : [];
  return [first, ...remaining].flatMap((page) => page.data ?? []);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const set = url.searchParams.get('set')?.toUpperCase();
  const language = url.searchParams.get('lang') === 'en' ? 'en' : 'de';
  if (!set || !/^[A-Z0-9]{2,8}$/.test(set)) return Response.json({ error: 'Ungültiger Set-Code' }, { status: 400 });

  const response = await fetch(`https://api.swu-db.com/cards/${set.toLowerCase()}`, { headers: { accept: 'application/json' }, next: { revalidate } });
  if (!response.ok) return Response.json({ error: 'Karten konnten nicht geladen werden' }, { status: 502 });
  const payload = await response.json() as { data?: SourceCard[] } | SourceCard[];
  const source = Array.isArray(payload) ? payload : payload.data ?? [];
  const standardCards = source.filter((card) => card.VariantType === 'Normal' || card.VariantType === 'Standard');
  const catalogSource = standardCards.length ? standardCards : source;
  const swudbShowcaseByName = new Map(source.filter((card) => card.VariantType === 'Showcase').map((card) => [`${card.Name}|${card.Subtitle ?? ''}`, card]));
  const swudbPrestigeByName = new Map(source.filter((card) => card.VariantType === 'Prestige').map((card) => [`${card.Name}|${card.Subtitle ?? ''}`, card]));
  const swudbPrestigeFoilByName = new Map(source.filter((card) => card.VariantType === 'Prestige Foil').map((card) => [`${card.Name}|${card.Subtitle ?? ''}`, card]));
  const swudbSerializedByName = new Map(source.filter((card) => card.VariantType === 'Serialized').map((card) => [`${card.Name}|${card.Subtitle ?? ''}`, card]));

  let officialStandard: OfficialCard[] = [];
  let officialShowcases: OfficialCard[] = [];
  let market = { byName: new Map<string, ReturnType<typeof emptyMarketPrices>>(), updatedAt: null as string | null };
  try {
    [officialStandard, officialShowcases, market] = await Promise.all([
      fetchOfficialCards(set, language, 'filters[variantOf][id][$null]'),
      fetchOfficialCards(set, language, 'filters[showcase][$eq]'),
      getCardmarketPrices(catalogSource),
    ]);
  } catch {
    // SWU-DB remains the fallback when the localized official catalog is temporarily unavailable.
  }

  const officialByNumber = new Map<string, OfficialCard>();
  for (const card of officialStandard) {
    const key = String(card.attributes.cardNumber);
    const current = officialByNumber.get(key);
    if (!current || (card.attributes.cardCount ?? 0) > (current.attributes.cardCount ?? 0)) officialByNumber.set(key, card);
  }
  const officialShowcaseByBaseNumber = new Map(officialShowcases.flatMap((card) => {
    const baseNumber = card.attributes.variantOf?.data?.attributes?.cardNumber;
    return baseNumber == null ? [] : [[String(baseNumber), card] as const];
  }));
  const preferred = new Map<string, SourceCard>();
  for (const card of catalogSource) {
    const current = preferred.get(card.Number);
    if (!current || card.VariantType === 'Normal' || (current.VariantType !== 'Normal' && card.VariantType === 'Standard')) preferred.set(card.Number, card);
  }

  const cards = [...preferred.values()].map((card) => {
    const numberKey = String(Number.parseInt(card.Number, 10));
    const localized = officialByNumber.get(numberKey);
    const localizedShowcase = officialShowcaseByBaseNumber.get(numberKey);
    const swudbShowcase = swudbShowcaseByName.get(`${card.Name}|${card.Subtitle ?? ''}`);
    const swudbPrestige = swudbPrestigeByName.get(`${card.Name}|${card.Subtitle ?? ''}`);
    const swudbPrestigeFoil = swudbPrestigeFoilByName.get(`${card.Name}|${card.Subtitle ?? ''}`);
    const swudbSerialized = swudbSerializedByName.get(`${card.Name}|${card.Subtitle ?? ''}`);
    const prices = market.byName.get(`${card.Name}${card.Subtitle ? `, ${card.Subtitle}` : ''}`) ?? emptyMarketPrices();
    return {
      id: `${card.Set}_${card.Number}`,
      set: card.Set,
      number: card.Number,
      name: localized?.attributes.title ?? card.Name,
      subtitle: localized?.attributes.subtitle ?? card.Subtitle ?? '',
      type: card.Type ?? '',
      rarity: card.Rarity ?? 'Unbekannt',
      image: officialImage(localized) ?? card.FrontArt ?? `https://api.swu-db.com/cards/${card.Set.toLowerCase()}/${card.Number}?format=image`,
      backImage: officialImage(localized, 'artBack') ?? card.BackArt ?? null,
      aspects: card.Aspects ?? [],
      showcaseImage: officialImage(localizedShowcase) ?? swudbShowcase?.FrontArt ?? null,
      showcaseNumber: localizedShowcase ? String(localizedShowcase.attributes.cardNumber) : swudbShowcase?.Number ?? null,
      prestigeImage: swudbPrestige?.FrontArt ?? null,
      prestigeFoilImage: swudbPrestigeFoil?.FrontArt ?? null,
      serializedImage: swudbSerialized?.FrontArt ?? null,
      prices,
    };
  }).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  const localizedSetName = officialStandard[0]?.attributes.expansion?.data?.attributes?.name;
  return Response.json({ cards, set, setName: localizedSetName ?? null, language, count: cards.length, marketUpdatedAt: market.updatedAt, source: officialStandard.length ? 'Star Wars: Unlimited / SWU-DB / Cardmarket' : 'SWU-DB' });
}
