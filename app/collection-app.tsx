'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronDown, Download, Layers3, Minus, Plus, Search, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Card = { id: number; name: string; subtitle: string; set: string; number: string; rarity: string; color: string; regular: number; foil: number; hyperspace: number };

type ModelContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: Record<string, unknown>) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> };

const seed: Card[] = [
  { id: 1, name: 'Luke Skywalker', subtitle: 'Faithful Friend', set: 'Spark of Rebellion', number: '005', rarity: 'Rare', color: '#3b82f6', regular: 2, foil: 0, hyperspace: 1 },
  { id: 2, name: 'Darth Vader', subtitle: 'Dark Lord of the Sith', set: 'Spark of Rebellion', number: '010', rarity: 'Legendary', color: '#ef4444', regular: 1, foil: 1, hyperspace: 0 },
  { id: 3, name: 'The Mandalorian', subtitle: 'Sworn to the Creed', set: 'Shadows of the Galaxy', number: '018', rarity: 'Rare', color: '#d97706', regular: 3, foil: 0, hyperspace: 0 },
  { id: 4, name: 'Ahsoka Tano', subtitle: 'Snips', set: 'Twilight of the Republic', number: '014', rarity: 'Special', color: '#8b5cf6', regular: 0, foil: 0, hyperspace: 0 },
];

export default function CollectionApp({ user }: { user: { name: string; email: string } | null }) {
  const [cards, setCards] = useState(seed);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const shown = useMemo(() => cards.filter((card) => {
    const total = card.regular + card.foil + card.hyperspace;
    return `${card.name} ${card.subtitle} ${card.set} ${card.number}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'owned' ? total > 0 : total === 0));
  }), [cards, query, filter]);
  const totals = cards.reduce((sum, card) => sum + card.regular + card.foil + card.hyperspace, 0);
  const unique = cards.filter((card) => card.regular + card.foil + card.hyperspace > 0).length;

  async function save(card: Card) {
    if (!user) return;
    const response = await fetch('/api/collection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(card) });
    if (!response.ok) throw new Error('Speichern fehlgeschlagen');
    return (await response.json()).card as Card;
  }

  function adjust(id: number, field: 'regular' | 'foil' | 'hyperspace', amount: number) {
    const card = cardsRef.current.find((entry) => entry.id === id);
    if (!card) return;
    const next = { ...card, [field]: Math.max(0, card[field] + amount) };
    setCards((current) => current.map((entry) => entry.id === id ? next : entry));
    void save(next).catch(() => setNotice('Konnte noch nicht gespeichert werden'));
    setNotice(amount > 0 ? 'Karte hinzugefügt' : 'Bestand aktualisiert');
    window.setTimeout(() => setNotice(''), 1400);
  }

  useEffect(() => {
    if (!user) return;
    void fetch('/api/collection').then(async (response) => response.ok ? response.json() : null).then((data) => {
      if (data?.cards?.length) setCards(data.cards);
    });
  }, [user]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = context.registerTool({
      name: 'set_collection_card_quantity', title: 'Kartenbestand setzen', description: 'Setzt den Bestand einer Karte in der sichtbaren Sammlung für Normal, Foil oder Hyperspace.',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, set: { type: 'string' }, number: { type: 'string' }, variant: { type: 'string', enum: ['regular', 'foil', 'hyperspace'] }, quantity: { type: 'integer', minimum: 0 } }, required: ['name', 'set', 'number', 'variant', 'quantity'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const variant = input.variant;
        const quantity = input.quantity;
        if (!['regular', 'foil', 'hyperspace'].includes(String(variant)) || !Number.isInteger(quantity) || Number(quantity) < 0) throw new Error('Ungültiger Bestand');
        const found = cardsRef.current.find((card) => card.name.toLowerCase() === String(input.name).toLowerCase() && card.set.toLowerCase() === String(input.set).toLowerCase() && card.number === String(input.number));
        const base: Card = found ?? { id: -Date.now(), name: String(input.name), subtitle: '', set: String(input.set), number: String(input.number), rarity: 'Unbekannt', color: '#d6ad43', regular: 0, foil: 0, hyperspace: 0 };
        const next = { ...base, [String(variant)]: Number(quantity) } as Card;
        const saved = await save(next) ?? next;
        setCards((current) => found ? current.map((card) => card.id === found.id ? saved : card) : [...current, saved]);
        return { name: saved.name, set: saved.set, number: saved.number, variant, quantity };
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, [user]);

  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Card = { id: -Date.now(), name: String(data.get('name')), subtitle: String(data.get('subtitle') ?? ''), set: String(data.get('set')), number: String(data.get('number')), rarity: String(data.get('rarity') ?? 'Unbekannt'), color: '#d6ad43', regular: Number(data.get('regular') ?? 0), foil: 0, hyperspace: 0 };
    try { const saved = await save(next) ?? next; setCards((current) => [...current.filter((card) => !(card.set === saved.set && card.number === saved.number)), saved]); setAdding(false); setNotice('Karte gespeichert'); } catch { setNotice('Bitte zuerst anmelden'); }
  }

  function exportCollection() {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'holocron-sammlung.json'; link.click(); URL.revokeObjectURL(url);
  }

  async function importCollection(file?: File) {
    if (!file) return;
    try { const imported = JSON.parse(await file.text()) as Card[]; if (!Array.isArray(imported)) throw new Error(); for (const card of imported) await save(card); setCards(imported); setNotice(`${imported.length} Karten importiert`); } catch { setNotice('Diese Datei konnte nicht importiert werden'); }
  }

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-white/8 bg-[#090b10]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-300"><Layers3 /></div><div><p className="text-lg font-bold tracking-tight">Holocron</p><p className="text-xs text-slate-400">SWU Collection Tracker</p></div></div>
        <div className="flex items-center gap-2"><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => void importCollection(event.target.files?.[0])} /><Button variant="ghost" onClick={exportCollection} className="hidden text-slate-300 sm:flex"><Download /> Export</Button><Button variant="outline" onClick={() => fileRef.current?.click()} className="hidden border-white/10 bg-white/5 text-slate-200 sm:flex"><Upload /> Import</Button>{user ? <div className="grid size-9 place-items-center rounded-full bg-amber-300 font-bold text-slate-950" title={user.email}>{user.name.charAt(0).toUpperCase()}</div> : <a href="/signin-with-chatgpt?return_to=%2F" target="_top" className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950">Anmelden</a>}</div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1440px] gap-7 px-5 py-7 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
      <aside className="space-y-5">
        <section className="rounded-2xl border border-white/8 bg-card p-5 shadow-2xl shadow-black/20"><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Deine Sammlung</p><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-3xl font-bold">{totals}</p><p className="text-xs text-slate-400">Karten gesamt</p></div><div><p className="text-3xl font-bold">{unique}</p><p className="text-xs text-slate-400">Verschiedene</p></div></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-amber-400 to-amber-200" /></div><p className="mt-2 text-xs text-slate-500">4 Einträge im Katalog</p></section>
        <nav className="space-y-1 rounded-2xl border border-white/8 bg-card p-2" aria-label="Sammlungsfilter">{[['all', 'Alle Karten'], ['owned', 'In Sammlung'], ['missing', 'Fehlende Karten']].map(([value, label]) => <button key={value} onClick={() => setFilter(value as typeof filter)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${filter === value ? 'bg-amber-300/12 font-semibold text-amber-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{value === 'all' ? <Archive className="size-4" /> : value === 'owned' ? <Sparkles className="size-4" /> : <Layers3 className="size-4" />}{label}</button>)}</nav>
      </aside>
      <section>
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-sm font-medium text-amber-300">SAMMLUNG</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Welche Karten besitzt du?</h1><p className="mt-2 text-sm text-slate-400">Bestände in Sekunden erfassen – inklusive Foil und Hyperspace.</p></div><Button onClick={() => setAdding(true)} className="h-10 bg-amber-300 px-4 font-semibold text-slate-950 hover:bg-amber-200"><Plus /> Karte erfassen</Button></div>
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/8 bg-card p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Karte, Set oder Nummer suchen …" className="h-11 border-white/8 bg-[#0d1017] pl-9" /></div><button className="flex h-11 items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#0d1017] px-4 text-sm text-slate-300">Alle Sets <ChevronDown className="size-4" /></button></div>
        <div className="space-y-3">{shown.map((card) => { const total = card.regular + card.foil + card.hyperspace; return <article key={card.id} className="grid gap-4 rounded-2xl border border-white/8 bg-card p-4 transition hover:border-amber-300/20 sm:grid-cols-[64px_minmax(190px,1fr)_minmax(300px,1.15fr)_68px] sm:items-center">
          <div className="grid h-20 w-14 place-items-center rounded-lg border border-white/10 bg-gradient-to-br from-white/10 to-transparent shadow-lg" style={{ boxShadow: `inset 3px 0 0 ${card.color}` }}><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SWU</span></div>
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold">{card.name}</h2><span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{card.rarity}</span></div><p className="text-sm text-slate-400">{card.subtitle}</p><p className="mt-1 text-xs text-slate-500">{card.set} · #{card.number}</p></div>
          <div className="grid grid-cols-3 gap-2">{(['regular', 'foil', 'hyperspace'] as const).map((field) => <div key={field} className="rounded-xl border border-white/8 bg-[#0d1017] p-2 text-center"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{field === 'regular' ? 'Normal' : field === 'foil' ? 'Foil' : 'Hyper'}</p><div className="flex items-center justify-center gap-1"><button aria-label={`${card.name} ${field} entfernen`} onClick={() => adjust(card.id, field, -1)} className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-white/8 hover:text-white"><Minus className="size-3" /></button><strong className="w-6 tabular-nums">{card[field]}</strong><button aria-label={`${card.name} ${field} hinzufügen`} onClick={() => adjust(card.id, field, 1)} className="grid size-7 place-items-center rounded-lg bg-white/6 text-slate-300 hover:bg-amber-300 hover:text-slate-950"><Plus className="size-3" /></button></div></div>)}</div>
          <div className="text-center"><p className={`text-2xl font-bold ${total ? 'text-amber-300' : 'text-slate-600'}`}>{total}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Gesamt</p></div>
        </article>; })}{shown.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-400">Keine passende Karte gefunden.</div>}</div>
      </section>
    </div>
    {adding && <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="add-title" className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#151821] p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">Neue Karte</p><h2 id="add-title" className="mt-1 text-2xl font-bold">Karte erfassen</h2></div><Button size="icon" variant="ghost" onClick={() => setAdding(false)} aria-label="Schließen"><X /></Button></div><form onSubmit={addCard} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300 sm:col-span-2">Kartenname<Input name="name" required autoFocus className="mt-1 h-10 bg-black/20" placeholder="z. B. Yoda" /></label><label className="text-sm text-slate-300 sm:col-span-2">Untertitel<Input name="subtitle" className="mt-1 h-10 bg-black/20" placeholder="optional" /></label><label className="text-sm text-slate-300">Set<Input name="set" required className="mt-1 h-10 bg-black/20" placeholder="Setname" /></label><label className="text-sm text-slate-300">Kartennummer<Input name="number" required className="mt-1 h-10 bg-black/20" placeholder="001" /></label><label className="text-sm text-slate-300">Seltenheit<Input name="rarity" className="mt-1 h-10 bg-black/20" placeholder="Rare" /></label><label className="text-sm text-slate-300">Anzahl Normal<Input name="regular" type="number" min="0" defaultValue="1" className="mt-1 h-10 bg-black/20" /></label><div className="mt-2 flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Abbrechen</Button><Button type="submit" className="bg-amber-300 text-slate-950 hover:bg-amber-200">Speichern</Button></div></form></div></div>}
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-xl">{notice}</div>}
  </main>;
}
