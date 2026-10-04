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

type BulkCard = {
  setCode: string;
  cardNumber: string;
  name: string;
  subtitle?: string | null;
  type?: string;
  rarity?: string;
  variantType?: string;
  frontImageUrl?: string;
  backImageUrl?: string | null;
  aspects?: string[];
};

type BulkExport = { cards?: BulkCard[] };

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

function bulkVariant(variant = '') {
  if (variant === 'Standard') return 'Normal';
  if (variant === 'Standard Prestige') return 'Prestige';
  if (variant === 'Foil Prestige') return 'Prestige Foil';
  if (variant === 'Serialized Prestige') return 'Serialized';
  return variant;
}

function sourceFromBulk(card: BulkCard): SourceCard {
  return {
    Set: card.setCode,
    Number: card.cardNumber,
    Name: card.name,
    Subtitle: card.subtitle ?? undefined,
    Type: card.type,
    Rarity: card.rarity,
    VariantType: bulkVariant(card.variantType),
    FrontArt: card.frontImageUrl,
    BackArt: card.backImageUrl ?? undefined,
    Aspects: card.aspects,
  };
}

function buildBulkCatalog(source: SourceCard[]) {
  const variants = (kind: string) => new Map(source.filter((card) => card.VariantType === kind).map((card) => [`${card.Set}|${card.Name}|${card.Subtitle ?? ''}`, card]));
  const showcases = variants('Showcase');
  const prestige = variants('Prestige');
  const prestigeFoil = variants('Prestige Foil');
  const serialized = variants('Serialized');
  const setsWithStandardCards = new Set(source.filter((card) => card.VariantType === 'Normal' || card.VariantType === 'Standard').map((card) => card.Set));
  const preferred = new Map<string, SourceCard>();
  for (const card of source) {
    if (setsWithStandardCards.has(card.Set) && card.VariantType !== 'Normal' && card.VariantType !== 'Standard') continue;
    const key = `${card.Set}|${card.Number}`;
    const current = preferred.get(key);
    const isStandard = card.VariantType === 'Normal' || card.VariantType === 'Standard';
    const currentIsStandard = current?.VariantType === 'Normal' || current?.VariantType === 'Standard';
    if (!current || (isStandard && !currentIsStandard)) preferred.set(key, card);
  }
  return [...preferred.values()].map((card) => {
    const key = `${card.Set}|${card.Name}|${card.Subtitle ?? ''}`;
    return {
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
      showcaseImage: showcases.get(key)?.FrontArt ?? null,
      showcaseNumber: showcases.get(key)?.Number ?? null,
      prestigeImage: prestige.get(key)?.FrontArt ?? null,
      prestigeFoilImage: prestigeFoil.get(key)?.FrontArt ?? null,
      serializedImage: serialized.get(key)?.FrontArt ?? null,
      prices: emptyMarketPrices(),
    };
  }).sort((a, b) => a.set.localeCompare(b.set) || a.number.localeCompare(b.number, undefined, { numeric: true }));
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
  if (!set || !/^(ALL|[A-Z0-9]{2,8})$/.test(set)) return Response.json({ error: 'Ungültiger Set-Code' }, { status: 400 });

  if (set === 'ALL') {
    const bulkResponse = await fetch('https://api.swuapi.com/export/all', { headers: { accept: 'application/json' }, next: { revalidate } });
    if (!bulkResponse.ok) return Response.json({ error: 'Karten konnten nicht geladen werden' }, { status: 502 });
    const bulk = await bulkResponse.json() as BulkExport;
    const cards = buildBulkCatalog((bulk.cards ?? []).map(sourceFromBulk));
    return Response.json({ cards, set, setName: 'Alle Sets', language, count: cards.length, marketUpdatedAt: null, source: 'SWU API' });
  }

  const response = await fetch(`https://api.swu-db.com/cards/${set.toLowerCase()}`, { headers: { accept: 'application/json' }, next: { revalidate } });
  let source: SourceCard[] = [];
  if (response.ok) {
    const payload = await response.json() as { data?: SourceCard[] } | SourceCard[];
    source = Array.isArray(payload) ? payload : payload.data ?? [];
  } else {
    const fallback = await fetch('https://api.swuapi.com/export/all', { headers: { accept: 'application/json' }, next: { revalidate } });
    if (!fallback.ok) return Response.json({ error: 'Karten konnten nicht geladen werden' }, { status: 502 });
    const payload = await fallback.json() as BulkExport;
    source = (payload.cards ?? []).filter((card) => card.setCode === set).map(sourceFromBulk);
  }
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
