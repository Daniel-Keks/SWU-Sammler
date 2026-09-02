type CatalogSource = { Name: string; Subtitle?: string; Type?: string };

type Product = {
  idProduct: number;
  name: string;
  idExpansion: number;
};

type PriceGuide = {
  idProduct: number;
  trend: number | null;
  'trend-foil': number | null;
};

export type MarketPrices = {
  regular: number | null;
  foil: number | null;
  hyperspace: number | null;
  hyperfoil: number | null;
  showcase: number | null;
};

const EMPTY: MarketPrices = { regular: null, foil: null, hyperspace: null, hyperfoil: null, showcase: null };
const MARKET_REVALIDATE = 86400;
const cardName = (card: CatalogSource) => `${card.Name}${card.Subtitle ? `, ${card.Subtitle}` : ''}`;

export async function getCardmarketPrices(cards: CatalogSource[]) {
  const [productsResponse, pricesResponse] = await Promise.all([
    fetch('https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_21.json', { next: { revalidate: MARKET_REVALIDATE } }),
    fetch('https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_21.json', { next: { revalidate: MARKET_REVALIDATE } }),
  ]);
  if (!productsResponse.ok || !pricesResponse.ok) throw new Error('Cardmarket price files unavailable');

  const productsPayload = await productsResponse.json() as { products?: Product[]; createdAt?: string };
  const pricesPayload = await pricesResponse.json() as { priceGuides?: PriceGuide[]; createdAt?: string };
  const wantedNames = new Set(cards.map(cardName));
  const baseNames = cards.filter((card) => card.Type?.toLowerCase().includes('base')).map((card) => `${card.Name} //`);
  const matchingProducts = (productsPayload.products ?? []).filter((product) => wantedNames.has(product.name) || baseNames.some((name) => product.name.startsWith(name)));
  const expansionMatches = new Map<number, Set<string>>();
  for (const product of matchingProducts) {
    const names = expansionMatches.get(product.idExpansion) ?? new Set<string>();
    names.add(product.name);
    expansionMatches.set(product.idExpansion, names);
  }
  const likelyExpansions = [...expansionMatches.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 2).map(([id]) => id).sort((a, b) => a - b);
  const mainExpansion = likelyExpansions[0];
  const extrasExpansion = likelyExpansions[1];
  const priceByProduct = new Map((pricesPayload.priceGuides ?? []).map((price) => [price.idProduct, price]));
  const byName = new Map<string, MarketPrices>();
  for (const card of cards) {
    const name = cardName(card);
    const isBase = card.Type?.toLowerCase().includes('base') ?? false;
    const products = matchingProducts.filter((product) => (product.name === name || (isBase && product.name.startsWith(`${card.Name} //`))) && (product.idExpansion === mainExpansion || product.idExpansion === extrasExpansion));
    const main = products.find((product) => product.idExpansion === mainExpansion);
    const extras = products.filter((product) => product.idExpansion === extrasExpansion);
    const mainPrice = main ? priceByProduct.get(main.idProduct) : undefined;
    const isLeader = card.Type?.toLowerCase().includes('leader') ?? false;
    let hyperspaceProduct: Product | undefined;
    let showcaseProduct: Product | undefined;
    if (isLeader && extras.length > 1) {
      const rank = (product: Product) => {
        const price = priceByProduct.get(product.idProduct);
        return Math.max(price?.trend ?? -1, price?.['trend-foil'] ?? -1);
      };
      const ranked = [...extras].sort((a, b) => rank(b) - rank(a));
      showcaseProduct = ranked[0];
      hyperspaceProduct = ranked.at(-1);
    } else {
      hyperspaceProduct = extras[0];
    }
    const hyperspacePrice = hyperspaceProduct ? priceByProduct.get(hyperspaceProduct.idProduct) : undefined;
    const showcasePrice = showcaseProduct ? priceByProduct.get(showcaseProduct.idProduct) : undefined;
    byName.set(name, {
      regular: mainPrice?.trend ?? null,
      foil: mainPrice?.['trend-foil'] || null,
      hyperspace: hyperspacePrice?.trend ?? null,
      hyperfoil: isLeader ? null : hyperspacePrice?.['trend-foil'] || null,
      showcase: showcasePrice ? Math.max(showcasePrice.trend ?? 0, showcasePrice['trend-foil'] ?? 0) || null : null,
    });
  }
  return { byName, updatedAt: pricesPayload.createdAt ?? null };
}

export function emptyMarketPrices() {
  return { ...EMPTY };
}
