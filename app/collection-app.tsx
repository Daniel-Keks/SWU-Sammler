'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Download, ImageOff, Layers3, Minus, Plus, Search, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type CatalogCard = { id: string; set: string; number: string; name: string; subtitle: string; type: string; rarity: string; image: string; backImage: string | null; aspects: string[] };
type Inventory = { id?: number; name: string; subtitle: string; set: string; number: string; rarity: string; color: string; regular: number; foil: number; hyperspace: number };
type SetInfo = { code: string; name: string; cardCount: number; releaseDate: string | null; parent: string | null };
type Variant = 'regular' | 'foil' | 'hyperspace';
type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: Record<string, unknown>) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> };

const PAGE_SIZE = 36;
const keyOf = (set: string, number: string) => `${set}:${number}`;

function CardImage({ card }: { card: CatalogCard }) {
  const [broken, setBroken] = useState(false);
  return <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-xl bg-[#0b0d13] shadow-[0_16px_35px_rgb(0_0_0/35%)]">
    {broken ? <div className="grid h-full place-items-center text-slate-600"><ImageOff className="size-8" /></div> : <img src={card.image} alt={`${card.name}${card.subtitle ? ` – ${card.subtitle}` : ''}`} loading="lazy" className="h-full w-full object-contain" onError={() => setBroken(true)} />}
    <span className="absolute bottom-2 left-2 rounded-md bg-black/75 px-1.5 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur">{card.set} {card.number}</span>
  </div>;
}

export default function CollectionApp({ user }: { user: { name: string; email: string } | null }) {
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [setCode, setSetCode] = useState('');
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [inventory, setInventory] = useState<Record<string, Inventory>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
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
    setLoading(true); setVisible(PAGE_SIZE);
    void fetch(`/api/catalog/cards?set=${encodeURIComponent(setCode)}`).then((response) => response.json()).then((data) => setCatalog(data.cards ?? [])).catch(() => setNotice('Karten konnten nicht geladen werden')).finally(() => setLoading(false));
  }, [setCode]);

  useEffect(() => {
    if (!user) return;
    void fetch('/api/collection').then(async (response) => response.ok ? response.json() : null).then((data) => {
      const next: Record<string, Inventory> = {};
      for (const card of data?.cards ?? []) next[keyOf(card.set, card.number)] = card;
      setInventory(next);
    });
  }, [user]);

  const shown = useMemo(() => catalog.filter((card) => {
    const item = inventory[keyOf(card.set, card.number)];
    const total = item ? item.regular + item.foil + item.hyperspace : 0;
    const haystack = `${card.name} ${card.subtitle} ${card.set} ${card.number} ${card.type} ${card.rarity}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === 'all' || (filter === 'owned' ? total > 0 : total === 0));
  }), [catalog, filter, inventory, query]);

  const ownedCards = Object.values(inventory).filter((card) => card.regular + card.foil + card.hyperspace > 0);
  const copies = ownedCards.reduce((sum, card) => sum + card.regular + card.foil + card.hyperspace, 0);
  const selectedSet = sets.find((set) => set.code === setCode);

  async function save(card: Inventory) {
    if (!user) throw new Error('Bitte anmelden');
    const response = await fetch('/api/collection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(card) });
    if (!response.ok) throw new Error('Speichern fehlgeschlagen');
    return (await response.json()).card as Inventory;
  }

  function adjust(card: CatalogCard, variant: Variant, amount: number) {
    if (!user) { setNotice('Bitte anmelden, um Bestände zu speichern'); return; }
    const key = keyOf(card.set, card.number);
    const current = inventoryRef.current[key] ?? { name: card.name, subtitle: card.subtitle, set: card.set, number: card.number, rarity: card.rarity, color: '#d6ad43', regular: 0, foil: 0, hyperspace: 0 };
    const next = { ...current, [variant]: Math.max(0, current[variant] + amount) };
    setInventory((items) => ({ ...items, [key]: next }));
    void save(next).then((saved) => setInventory((items) => ({ ...items, [key]: saved }))).catch(() => setNotice('Bestand konnte nicht gespeichert werden'));
  }

  function exportCollection() {
    const blob = new Blob([JSON.stringify(Object.values(inventory), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'swu-sammler-sammlung.json'; link.click(); URL.revokeObjectURL(url);
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
      name: 'set_collection_card_quantity', title: 'Kartenbestand setzen', description: 'Setzt den Bestand einer SWU-Karte für Normal, Foil oder Hyperspace.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, set: { type: 'string' }, number: { type: 'string' }, variant: { type: 'string', enum: ['regular', 'foil', 'hyperspace'] }, quantity: { type: 'integer', minimum: 0 } }, required: ['name', 'set', 'number', 'variant', 'quantity'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const variant = String(input.variant) as Variant; const quantity = Number(input.quantity);
        if (!['regular', 'foil', 'hyperspace'].includes(variant) || !Number.isInteger(quantity) || quantity < 0) throw new Error('Ungültiger Bestand');
        const key = keyOf(String(input.set), String(input.number));
        const current = inventoryRef.current[key] ?? { name: String(input.name), subtitle: '', set: String(input.set), number: String(input.number), rarity: 'Unbekannt', color: '#d6ad43', regular: 0, foil: 0, hyperspace: 0 };
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
        <div className="flex items-center gap-1 sm:gap-2"><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importCollection(event.target.files?.[0])} /><Button variant="ghost" size="sm" onClick={exportCollection} className="hidden text-slate-300 md:flex"><Download /> Export</Button><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="hidden border-white/10 bg-white/5 text-slate-200 md:flex"><Upload /> Import</Button>{user ? <div className="ml-1 grid size-9 place-items-center rounded-full bg-amber-300 font-bold text-slate-950" title={user.email}>{user.name.charAt(0).toUpperCase()}</div> : <a href="/signin-with-chatgpt?return_to=%2F" target="_top" className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950">Anmelden</a>}</div>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
      <aside className="space-y-4">
        <section className="rounded-2xl border border-white/8 bg-card p-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Deine Sammlung</p><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-3xl font-bold">{copies}</p><p className="text-xs text-slate-400">Exemplare</p></div><div><p className="text-3xl font-bold">{ownedCards.length}</p><p className="text-xs text-slate-400">Karten</p></div></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200" style={{ width: `${catalogTotal ? Math.min(100, ownedCards.length / catalogTotal * 100) : 0}%` }} /></div><p className="mt-2 text-xs text-slate-500">{catalogTotal.toLocaleString('de-DE')} Katalogeinträge</p></section>
        <nav className="space-y-1 rounded-2xl border border-white/8 bg-card p-2" aria-label="Sammlungsfilter">{[['all', 'Alle Karten'], ['owned', 'In Sammlung'], ['missing', 'Fehlende Karten']].map(([value, label]) => <button key={value} onClick={() => { setFilter(value as typeof filter); setVisible(PAGE_SIZE); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${filter === value ? 'bg-amber-300/12 font-semibold text-amber-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{value === 'all' ? <Archive className="size-4" /> : value === 'owned' ? <Sparkles className="size-4" /> : <Layers3 className="size-4" />}{label}</button>)}</nav>
        <p className="px-2 text-[11px] leading-relaxed text-slate-600">Inoffizielles Fanprojekt. Kartendaten: SWU-DB. Kartenbilder © Fantasy Flight Games / Lucasfilm.</p>
      </aside>

      <section className="min-w-0">
        <div className="mb-5"><p className="text-sm font-medium text-amber-300">KARTENKATALOG</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Alle Star Wars: Unlimited Karten</h1><p className="mt-2 text-sm text-slate-400">Wähle ein Set und trage deine Varianten direkt an der Karte ein.</p></div>
        <div className="mb-5 grid gap-3 rounded-2xl border border-white/8 bg-card p-3 sm:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }} placeholder="Name, Nummer, Typ oder Seltenheit …" className="h-11 border-white/8 bg-[#0d1017] pl-9" /></div>
          <select aria-label="Kartenset" value={setCode} onChange={(event) => setSetCode(event.target.value)} className="h-11 rounded-lg border border-white/8 bg-[#0d1017] px-3 text-sm text-slate-200 outline-none focus:border-amber-300/50">{sets.map((set) => <option key={set.code} value={set.code}>{set.code} · {set.name} ({set.cardCount})</option>)}</select>
        </div>
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{selectedSet?.name ?? 'Karten werden geladen'}</h2><p className="text-xs text-slate-500">{loading ? 'Katalog wird aktualisiert …' : `${shown.length} Karten gefunden`}</p></div></div>

        {loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-[2.5/4.9] animate-pulse rounded-2xl bg-white/5" />)}</div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{shown.slice(0, visible).map((card) => {
          const item = inventory[keyOf(card.set, card.number)] ?? { regular: 0, foil: 0, hyperspace: 0 };
          const total = item.regular + item.foil + item.hyperspace;
          return <article key={card.id} className="rounded-2xl border border-white/8 bg-card p-3 transition hover:-translate-y-0.5 hover:border-amber-300/20">
            <CardImage card={card} />
            <div className="min-h-[70px] px-1 pt-3"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 text-sm font-bold leading-tight">{card.name}</h3><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${total ? 'bg-amber-300 text-slate-950' : 'bg-white/6 text-slate-500'}`}>{total}</span></div><p className="mt-1 line-clamp-1 text-xs text-slate-500">{card.subtitle || `${card.type} · ${card.rarity}`}</p></div>
            <div className="mt-2 grid gap-1.5">{(['regular', 'foil', 'hyperspace'] as Variant[]).map((variant) => <div key={variant} className="flex items-center justify-between rounded-lg bg-[#0d1017] px-2 py-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{variant === 'regular' ? 'Normal' : variant === 'foil' ? 'Foil' : 'Hyper'}</span><div className="flex items-center"><button aria-label={`${card.name} ${variant} entfernen`} onClick={() => adjust(card, variant, -1)} className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-white/8 hover:text-white"><Minus className="size-3" /></button><strong className="w-6 text-center text-xs tabular-nums">{item[variant]}</strong><button aria-label={`${card.name} ${variant} hinzufügen`} onClick={() => adjust(card, variant, 1)} className="grid size-7 place-items-center rounded-md bg-white/6 text-slate-300 hover:bg-amber-300 hover:text-slate-950"><Plus className="size-3" /></button></div></div>)}</div>
          </article>;
        })}</div>}
        {!loading && shown.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-400">Keine passende Karte gefunden.</div>}
        {!loading && visible < shown.length && <div className="mt-6 text-center"><Button variant="outline" onClick={() => setVisible((count) => count + PAGE_SIZE)} className="border-white/10 bg-white/5">Mehr Karten anzeigen ({shown.length - visible})</Button></div>}
      </section>
    </div>
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-xl">{notice}</div>}
  </main>;
}
