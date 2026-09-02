'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Check, Download, ExternalLink, ImageOff, Layers3, Link2, Minus, Plus, Search, Sparkles, Trophy, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type MarketPrices = { regular: number | null; foil: number | null; hyperspace: number | null; hyperfoil: number | null; showcase: number | null };
type CatalogCard = { id: string; set: string; number: string; name: string; subtitle: string; type: string; rarity: string; image: string; backImage: string | null; aspects: string[]; showcaseImage: string | null; showcaseNumber: string | null; prices: MarketPrices };
type Inventory = { id?: number; name: string; subtitle: string; set: string; number: string; rarity: string; color: string; regular: number; foil: number; hyperspace: number; hyperfoil: number; showcase: number };
type SetInfo = { code: string; name: string; cardCount: number; releaseDate: string | null; parent: string | null };
type Variant = 'regular' | 'foil' | 'hyperspace' | 'hyperfoil' | 'showcase';
type Language = 'de' | 'en';
type CatalogFilter = 'all' | 'owned' | 'missing' | 'valuable';
type AppView = 'collection' | 'decks';
type DeckLine = { set: string; number: string; name: string; count: number; board: 'leader' | 'base' | 'main' | 'sideboard' };
type ImportedDeck = { source: 'SWUDB' | 'SWUBase'; name: string; cards: DeckLine[] };
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: Record<string, unknown>) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> };

const PAGE_SIZE = 36;
const keyOf = (set: string, number: string) => `${set}:${number}`;
const inventoryTotal = (card: Pick<Inventory, 'set' | 'regular' | 'foil' | 'hyperspace' | 'hyperfoil' | 'showcase'>) => card.regular + (card.set === 'ASH' ? 0 : card.foil) + card.hyperspace + card.hyperfoil + card.showcase;
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const marketValue = (card: CatalogCard, item: Pick<Inventory, 'regular' | 'foil' | 'hyperspace' | 'hyperfoil' | 'showcase'>) => (Object.keys(card.prices) as Variant[]).reduce((sum, variant) => sum + item[variant] * (card.prices[variant] ?? 0), 0);

function CardImage({ card, ownedShowcase }: { card: CatalogCard; ownedShowcase: boolean }) {
  const [broken, setBroken] = useState(false);
  const [showcase, setShowcase] = useState(ownedShowcase);
  useEffect(() => {
    setBroken(false);
    setShowcase(ownedShowcase);
  }, [ownedShowcase]);
  return <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-xl bg-[#0b0d13] shadow-[0_16px_35px_rgb(0_0_0/35%)]">
    {broken ? <div className="grid h-full place-items-center text-slate-600"><ImageOff className="size-8" /></div> : <img src={showcase && card.showcaseImage ? card.showcaseImage : card.image} alt={`${card.name}${showcase ? ' – Showcase' : card.subtitle ? ` – ${card.subtitle}` : ''}`} loading="lazy" className="h-full w-full object-contain" onError={() => setBroken(true)} />}
    <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-1.5 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur">{card.set} {card.number}</span>
    {card.showcaseImage && <button type="button" onClick={() => { setBroken(false); setShowcase((value) => !value); }} className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide backdrop-blur ${showcase ? 'bg-amber-300 text-slate-950' : 'bg-black/75 text-amber-200'}`}>{showcase ? 'Standard' : 'Showcase'}</button>}
  </div>;
}

function DeckChecker({ user, deckUrl, setDeckUrl, deck, loading, inventory, onImport }: {
  user: { name: string; email: string } | null;
  deckUrl: string;
  setDeckUrl: (value: string) => void;
  deck: ImportedDeck | null;
  loading: boolean;
  inventory: Record<string, Inventory>;
  onImport: () => void;
}) {
  const compared = useMemo(() => {
    if (!deck) return [];
    const merged = new Map<string, DeckLine>();
    for (const card of deck.cards) {
      const key = keyOf(card.set, card.number);
      const current = merged.get(key);
      merged.set(key, current ? { ...current, count: current.count + card.count, board: current.board === card.board ? current.board : 'main' } : card);
    }
    return [...merged.values()].map((card) => {
      const item = inventory[keyOf(card.set, card.number)];
      const owned = item ? inventoryTotal(item) : 0;
      return { ...card, owned, missing: Math.max(0, card.count - owned) };
    }).sort((a, b) => b.missing - a.missing || a.board.localeCompare(b.board) || a.name.localeCompare(b.name));
  }, [deck, inventory]);
  const requiredCopies = compared.reduce((sum, card) => sum + card.count, 0);
  const missingCopies = compared.reduce((sum, card) => sum + card.missing, 0);
  const complete = deck != null && missingCopies === 0;

  return <section className="min-w-0">
    <div className="mb-5"><p className="text-sm font-medium text-amber-300">DECK-CHECK</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Kann ich dieses Deck bauen?</h1><p className="mt-2 text-sm text-slate-400">Füge einen öffentlichen Decklink von SWUDB oder SWUBase ein. Alle Varianten einer Karte zählen gemeinsam.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); onImport(); }} className="grid gap-3 rounded-2xl border border-white/8 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="relative"><Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input type="url" required value={deckUrl} onChange={(event) => setDeckUrl(event.target.value)} placeholder="https://swudb.com/deck/… oder https://swubase.com/decks/…" className="h-12 border-white/8 bg-[#0d1017] pl-9" /></div>
      <Button type="submit" disabled={loading} className="h-12 bg-amber-300 px-6 font-bold text-slate-950 hover:bg-amber-200">{loading ? 'Deck wird geladen …' : 'Deck prüfen'}</Button>
    </form>

    {!user && <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-5 text-sm text-amber-100">Melde dich an, damit das Deck mit deinem gespeicherten Kartenbestand verglichen werden kann.</div>}

    {deck && <div className="mt-6 space-y-5">
      <div className={`rounded-2xl border p-5 ${complete ? 'border-emerald-400/30 bg-emerald-400/8' : 'border-amber-300/20 bg-card'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">{deck.source}</span><h2 className="text-xl font-bold">{deck.name}</h2></div><p className="mt-2 text-sm text-slate-400">{compared.length} verschiedene Karten · {requiredCopies} Karten insgesamt</p></div><div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${complete ? 'bg-emerald-300 text-emerald-950' : 'bg-amber-300 text-slate-950'}`}>{complete ? <Check className="size-6" /> : <X className="size-6" />}<div><p className="font-bold">{complete ? 'Deck vollständig' : `${missingCopies} Karten fehlen`}</p><p className="text-xs opacity-75">{complete ? 'Du besitzt alle benötigten Karten.' : `${compared.filter((card) => card.missing > 0).length} verschiedene Karten`}</p></div></div></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] gap-2 border-b border-white/8 bg-white/[.025] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"><span>Karte</span><span className="text-center">Benötigt</span><span className="text-center">Besitz</span><span className="text-center">Fehlt</span></div>
        <div className="divide-y divide-white/6">{compared.map((card) => <div key={keyOf(card.set, card.number)} className={`grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-center gap-2 px-4 py-3 ${card.missing ? 'bg-rose-400/[.035]' : ''}`}><div className="min-w-0"><p className="truncate text-sm font-semibold">{card.name}</p><p className="text-xs text-slate-500">{card.set} {card.number} · {card.board === 'leader' ? 'Anführer' : card.board === 'base' ? 'Basis' : card.board === 'sideboard' ? 'Sideboard' : 'Hauptdeck'}</p></div><span className="text-center text-sm font-bold tabular-nums">{card.count}</span><span className="text-center text-sm tabular-nums text-slate-300">{card.owned}</span><span className={`mx-auto grid size-8 place-items-center rounded-full text-sm font-bold tabular-nums ${card.missing ? 'bg-rose-400/15 text-rose-300' : 'bg-emerald-400/12 text-emerald-300'}`}>{card.missing || <Check className="size-4" />}</span></div>)}</div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500"><ExternalLink className="size-3" />Deckdaten werden direkt aus dem öffentlichen Link von {deck.source} geladen.</p>
    </div>}
  </section>;
}

export default function CollectionApp({ user }: { user: { name: string; email: string } | null }) {
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [setCode, setSetCode] = useState('');
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [language, setLanguage] = useState<Language>('de');
  const [localizedSetName, setLocalizedSetName] = useState('');
  const [marketUpdatedAt, setMarketUpdatedAt] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Record<string, Inventory>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<AppView>('collection');
  const [deckUrl, setDeckUrl] = useState('');
  const [deck, setDeck] = useState<ImportedDeck | null>(null);
  const [deckLoading, setDeckLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;

  useEffect(() => {
    void fetch('/api/catalog/sets').then((response) => response.json()).then((data) => {
      const nextSets = data.sets ?? [];
      setSets(nextSets);
      setCatalogTotal(data.totalCards ?? 0);
      setSetCode(nextSets.find((set: SetInfo) => set.code === 'ASH')?.code ?? nextSets[0]?.code ?? 'SOR');
    }).catch(() => setNotice('Sets konnten nicht geladen werden'));
  }, []);

  useEffect(() => {
    if (!setCode) return;
    if (setCode === 'ALL' && sets.length === 0) return;
    const controller = new AbortController();
    setLoading(true); setVisible(PAGE_SIZE);
    const codes = setCode === 'ALL' ? sets.map((set) => set.code) : [setCode];
    const loadCatalog = async () => {
      const results: Array<{ cards?: CatalogCard[]; setName?: string; marketUpdatedAt?: string | null }> = [];
      let failedSets = 0;
      for (let index = 0; index < codes.length; index += 6) {
        const batch = await Promise.allSettled(codes.slice(index, index + 6).map(async (code) => {
          const response = await fetch(`/api/catalog/cards?set=${encodeURIComponent(code)}&lang=${language}`, { signal: controller.signal });
          if (!response.ok) throw new Error(`Set ${code} nicht verfügbar`);
          return response.json();
        }));
        if (controller.signal.aborted) return;
        for (const result of batch) result.status === 'fulfilled' ? results.push(result.value) : failedSets += 1;
      }
      if (results.length === 0) throw new Error('Karten konnten nicht geladen werden');
      setCatalog(results.flatMap((data) => data.cards ?? []));
      setLocalizedSetName(setCode === 'ALL' ? 'Alle Sets' : results[0]?.setName ?? '');
      setMarketUpdatedAt(results.find((data) => data.marketUpdatedAt)?.marketUpdatedAt ?? null);
      if (failedSets > 0) setNotice(failedSets === 1 ? '1 derzeit nicht verfügbares Set wurde übersprungen' : `${failedSets} derzeit nicht verfügbare Sets wurden übersprungen`);
    };
    void loadCatalog().catch((error) => { if (error instanceof Error && error.name !== 'AbortError') setNotice('Karten konnten nicht geladen werden'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [language, setCode, sets]);

  useEffect(() => {
    if (!user) return;
    void fetch('/api/collection').then(async (response) => response.ok ? response.json() : null).then((data) => {
      const next: Record<string, Inventory> = {};
      for (const card of data?.cards ?? []) next[keyOf(card.set, card.number)] = card;
      setInventory(next);
    });
  }, [user]);

  const shown = useMemo(() => {
    const matches = catalog.filter((card) => {
    const item = inventory[keyOf(card.set, card.number)];
    const total = item ? inventoryTotal(item) : 0;
    const haystack = `${card.name} ${card.subtitle} ${card.set} ${card.number} ${card.type} ${card.rarity}`.toLowerCase();
    const ownedValue = item ? marketValue(card, item) : 0;
    return haystack.includes(query.toLowerCase()) && (filter === 'all' ? true : filter === 'valuable' ? total > 0 && ownedValue > 0 : filter === 'owned' ? total > 0 : total === 0);
    });
    return filter === 'valuable' ? matches.sort((a, b) => marketValue(b, inventory[keyOf(b.set, b.number)]!) - marketValue(a, inventory[keyOf(a.set, a.number)]!)).slice(0, 50) : matches;
  }, [catalog, filter, inventory, query]);

  const ownedCards = Object.values(inventory).filter((card) => inventoryTotal(card) > 0);
  const copies = ownedCards.reduce((sum, card) => sum + inventoryTotal(card), 0);
  const selectedSet = sets.find((set) => set.code === setCode);
  const selectedSetName = setCode === 'ALL' ? 'Alle Sets' : localizedSetName || selectedSet?.name;
  const selectedSetValue = catalog.reduce((sum, card) => {
    const item = inventory[keyOf(card.set, card.number)];
    return sum + (item ? marketValue(card, item) : 0);
  }, 0);

  async function save(card: Inventory) {
    if (!user) throw new Error('Bitte anmelden');
    const response = await fetch('/api/collection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(card) });
    if (!response.ok) throw new Error('Speichern fehlgeschlagen');
    return (await response.json()).card as Inventory;
  }

  function adjust(card: CatalogCard, variant: Variant, amount: number) {
    if (!user) { setNotice('Bitte anmelden, um Bestände zu speichern'); return; }
    const key = keyOf(card.set, card.number);
    const current = inventoryRef.current[key] ?? { name: card.name, subtitle: card.subtitle, set: card.set, number: card.number, rarity: card.rarity, color: '#d6ad43', regular: 0, foil: 0, hyperspace: 0, hyperfoil: 0, showcase: 0 };
    const next = { ...current, [variant]: Math.max(0, current[variant] + amount) };
    setInventory((items) => ({ ...items, [key]: next }));
    void save(next).then((saved) => setInventory((items) => ({ ...items, [key]: saved }))).catch(() => setNotice('Bestand konnte nicht gespeichert werden'));
  }

  function exportCollection() {
    const blob = new Blob([JSON.stringify(Object.values(inventory), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'swu-sammler-sammlung.json'; link.click(); URL.revokeObjectURL(url);
  }

  async function importDeck() {
    setDeckLoading(true);
    try {
      const response = await fetch('/api/decks/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: deckUrl }) });
      const data = await response.json() as ImportedDeck & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Deck konnte nicht geladen werden');
      setDeck(data);
      setNotice(`${data.name} wurde geladen`);
    } catch (error) {
      setDeck(null);
      setNotice(error instanceof Error ? error.message : 'Deck konnte nicht geladen werden');
    } finally {
      setDeckLoading(false);
    }
  }

  async function importCollection(file?: File) {
    if (!file) return;
    if (!user) { setNotice('Bitte zuerst anmelden'); return; }
    try {
      const cards = JSON.parse(await file.text()) as Inventory[];
      if (!Array.isArray(cards)) throw new Error();
      const next: Record<string, Inventory> = { ...inventoryRef.current };
      for (const card of cards) { const saved = await save(card); next[keyOf(saved.set, saved.number)] = saved; }
      setInventory(next); setNotice(`${cards.length} Bestände importiert`);
    } catch { setNotice('Diese Datei konnte nicht importiert werden'); }
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({
      name: 'set_collection_card_quantity', title: 'Kartenbestand setzen', description: 'Setzt den Bestand einer SWU-Karte für Normal, Foil, Hyperspace, Hyperfoil oder Showcase.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, set: { type: 'string' }, number: { type: 'string' }, variant: { type: 'string', enum: ['regular', 'foil', 'hyperspace', 'hyperfoil', 'showcase'] }, quantity: { type: 'integer', minimum: 0 } }, required: ['name', 'set', 'number', 'variant', 'quantity'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const variant = String(input.variant) as Variant; const quantity = Number(input.quantity);
        if (!['regular', 'foil', 'hyperspace', 'hyperfoil', 'showcase'].includes(variant) || !Number.isInteger(quantity) || quantity < 0) throw new Error('Ungültiger Bestand');
        if (String(input.set).toUpperCase() === 'ASH' && variant === 'foil') throw new Error('Für Asche des Imperiums wird keine Foil-Variante geführt');
        const key = keyOf(String(input.set), String(input.number));
        const current = inventoryRef.current[key] ?? { name: String(input.name), subtitle: '', set: String(input.set), number: String(input.number), rarity: 'Unbekannt', color: '#d6ad43', regular: 0, foil: 0, hyperspace: 0, hyperfoil: 0, showcase: 0 };
        const saved = await save({ ...current, [variant]: quantity });
        setInventory((items) => ({ ...items, [key]: saved }));
        return { name: saved.name, set: saved.set, number: saved.number, variant, quantity };
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, [user]);

  return <main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[#090b10]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-300"><Layers3 /></div><div><p className="text-lg font-bold tracking-tight">SWU Sammler</p><p className="text-xs text-slate-400">Vollständiger Kartenkatalog</p></div></div>
        <div className="flex items-center gap-1 sm:gap-2"><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importCollection(event.target.files?.[0])} />{view === 'collection' && <><Button variant="ghost" size="sm" onClick={exportCollection} className="hidden text-slate-300 md:flex"><Download /> Export</Button><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="hidden border-white/10 bg-white/5 text-slate-200 md:flex"><Upload /> Import</Button></>}{user ? <div className="ml-1 grid size-9 place-items-center rounded-full bg-amber-300 font-bold text-slate-950" title={user.email}>{user.name.charAt(0).toUpperCase()}</div> : <a href="/signin-with-chatgpt?return_to=%2F" target="_top" className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950">Anmelden</a>}</div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
      <aside className="space-y-4">
        <section className="rounded-2xl border border-white/8 bg-card p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Deine Sammlung</p><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-3xl font-bold">{copies}</p><p className="text-xs text-slate-400">Exemplare</p></div><div><p className="text-3xl font-bold">{ownedCards.length}</p><p className="text-xs text-slate-400">Karten</p></div></div><div className="mt-5 border-t border-white/8 pt-4"><p className="text-2xl font-bold text-emerald-300">{euro.format(selectedSetValue)}</p><p className="text-xs text-slate-400">{setCode === 'ALL' ? 'Cardmarket-Wert der gesamten Sammlung' : 'Cardmarket-Wert im gewählten Set'}</p></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200" style={{ width: `${catalogTotal ? Math.min(100, ownedCards.length / catalogTotal * 100) : 0}%` }} /></div><p className="mt-2 text-xs text-slate-500">{catalogTotal.toLocaleString('de-DE')} Katalogeinträge</p></section>
        <nav className="space-y-1 rounded-2xl border border-white/8 bg-card p-2" aria-label="Bereiche">
          <button onClick={() => setView('collection')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${view === 'collection' ? 'bg-amber-300/12 font-semibold text-amber-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Layers3 className="size-4" />Kartensammlung</button>
          <button onClick={() => setView('decks')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${view === 'decks' ? 'bg-amber-300/12 font-semibold text-amber-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Link2 className="size-4" />Deck prüfen</button>
        </nav>
        {view === 'collection' && <nav className="space-y-1 rounded-2xl border border-white/8 bg-card p-2" aria-label="Sammlungsfilter">{([['all', 'Alle Karten'], ['valuable', 'Meine wertvollsten'], ['owned', 'In Sammlung'], ['missing', 'Fehlende Karten']] as [CatalogFilter, string][]).map(([value, label]) => <button key={value} onClick={() => { setFilter(value); setVisible(PAGE_SIZE); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${filter === value ? 'bg-amber-300/12 font-semibold text-amber-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{value === 'all' ? <Archive className="size-4" /> : value === 'valuable' ? <Trophy className="size-4" /> : value === 'owned' ? <Sparkles className="size-4" /> : <Layers3 className="size-4" />}{label}</button>)}</nav>}
        <p className="px-2 text-[11px] leading-relaxed text-slate-600">Inoffizielles Fanprojekt. Kartendaten: SWU-DB. Kartenbilder © Fantasy Flight Games / Lucasfilm.</p>
      </aside>

      {view === 'collection' ? <section className="min-w-0">
        <div className="mb-5"><p className="text-sm font-medium text-amber-300">KARTENKATALOG</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Alle Star Wars: Unlimited Karten</h1><p className="mt-2 text-sm text-slate-400">Wähle ein Set und trage deine Varianten direkt an der Karte ein.</p></div>
        <div className="mb-5 grid gap-3 rounded-2xl border border-white/8 bg-card p-3 sm:grid-cols-[minmax(0,1fr)_280px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }} placeholder="Name, Nummer, Typ oder Seltenheit …" className="h-11 border-white/8 bg-[#0d1017] pl-9" /></div>
          <select aria-label="Kartenset" value={setCode} onChange={(event) => setSetCode(event.target.value)} className="h-11 rounded-lg border border-white/8 bg-[#0d1017] px-3 text-sm text-slate-200 outline-none focus:border-amber-300/50"><option value="ALL">Alle Sets · gesamter Katalog ({catalogTotal})</option>{sets.map((set) => <option key={set.code} value={set.code}>{set.code} · {set.name} ({set.cardCount})</option>)}</select>
          <div className="flex h-11 rounded-lg border border-white/8 bg-[#0d1017] p-1" aria-label="Kartensprache">{(['de', 'en'] as Language[]).map((value) => <button key={value} type="button" aria-pressed={language === value} onClick={() => setLanguage(value)} className={`min-w-12 rounded-md px-3 text-xs font-bold transition ${language === value ? 'bg-amber-300 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{value.toUpperCase()}</button>)}</div>
        </div>
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{selectedSetName ?? 'Karten werden geladen'}</h2><p className="text-xs text-slate-500">{loading ? `${setCode === 'ALL' ? 'Alle Sets' : language === 'de' ? 'Deutsche Karten' : 'Englische Karten'} werden geladen …` : `${shown.length} Karten gefunden · ${language === 'de' ? 'Deutsch' : 'Englisch'}${marketUpdatedAt ? ` · Cardmarket ${new Date(marketUpdatedAt).toLocaleDateString('de-DE')}` : ''}`}</p></div></div>

        {loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-[2.5/4.9] animate-pulse rounded-2xl bg-white/5" />)}</div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{shown.slice(0, visible).map((card) => {
          const item = inventory[keyOf(card.set, card.number)] ?? { regular: 0, foil: 0, hyperspace: 0, hyperfoil: 0, showcase: 0 };
          const total = item.regular + (card.set === 'ASH' ? 0 : item.foil) + item.hyperspace + item.hyperfoil + item.showcase;
          const isPlayset = total >= 3 && !['leader', 'anführer', 'base', 'basis'].some((type) => card.type.toLowerCase().includes(type));
          const cardValue = marketValue(card, item);
          return <article key={card.id} className={`rounded-2xl border bg-card p-3 transition hover:-translate-y-0.5 ${isPlayset ? 'border-emerald-400/35 shadow-[0_0_24px_rgb(52_211_153/8%)] hover:border-emerald-300/55' : 'border-white/8 hover:border-amber-300/20'}`}>
            <CardImage card={card} ownedShowcase={item.showcase > 0} />
            <div className="min-h-[86px] px-1 pt-3"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 text-sm font-bold leading-tight">{card.name}</h3><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isPlayset ? 'bg-emerald-300 text-emerald-950' : total ? 'bg-amber-300 text-slate-950' : 'bg-white/6 text-slate-500'}`}>{total}</span></div>{isPlayset && <p className="mt-1 inline-flex rounded-full bg-emerald-400/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.12em] text-emerald-300 ring-1 ring-inset ring-emerald-400/20">Playset voll</p>}<p className="mt-1 line-clamp-1 text-xs text-slate-500">{card.subtitle || `${card.type} · ${card.rarity}`}</p>{cardValue > 0 && <p className="mt-1 text-xs font-bold text-emerald-300">Dein Wert: {euro.format(cardValue)}</p>}</div>
            <div className="mt-2 grid gap-1.5">{(['regular', ...(card.set === 'ASH' ? [] : ['foil' as Variant]), 'hyperspace', ...(!['leader', 'anführer'].some((type) => card.type.toLowerCase().includes(type)) ? ['hyperfoil' as Variant] : []), ...(card.showcaseImage ? ['showcase' as Variant] : [])] as Variant[]).map((variant) => <div key={variant} className={`flex items-center justify-between rounded-lg px-2 py-1 ${variant === 'showcase' ? 'bg-amber-300/10 ring-1 ring-inset ring-amber-300/15' : 'bg-[#0d1017]'}`}><span className={`text-[10px] font-semibold uppercase tracking-wide ${variant === 'showcase' ? 'text-amber-300' : 'text-slate-500'}`}>{variant === 'regular' ? 'Normal' : variant === 'foil' ? 'Foil' : variant === 'hyperspace' ? 'Hyper' : variant === 'hyperfoil' ? 'Hyperfoil' : 'Showcase'}<small className="ml-1 font-normal normal-case tracking-normal text-slate-600">{card.prices[variant] != null ? euro.format(card.prices[variant]) : '–'}</small></span><div className="flex items-center"><button aria-label={`${card.name} ${variant} entfernen`} onClick={() => adjust(card, variant, -1)} className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-white/8 hover:text-white"><Minus className="size-3" /></button><strong className="w-6 text-center text-xs tabular-nums">{item[variant]}</strong><button aria-label={`${card.name} ${variant} hinzufügen`} onClick={() => adjust(card, variant, 1)} className="grid size-7 place-items-center rounded-md bg-white/6 text-slate-300 hover:bg-amber-300 hover:text-slate-950"><Plus className="size-3" /></button></div></div>)}</div>
          </article>;
        })}</div>}
        {!loading && shown.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-400">Keine passende Karte gefunden.</div>}
        {!loading && visible < shown.length && <div className="mt-6 text-center"><Button variant="outline" onClick={() => setVisible((count) => count + PAGE_SIZE)} className="border-white/10 bg-white/5">Mehr Karten anzeigen ({shown.length - visible})</Button></div>}
      </section> : <DeckChecker user={user} deckUrl={deckUrl} setDeckUrl={setDeckUrl} deck={deck} loading={deckLoading} inventory={inventory} onImport={() => void importDeck()} />}
    </div>
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-xl">{notice}</div>}
  </main>;
}
