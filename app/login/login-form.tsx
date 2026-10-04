'use client';

import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    if (response.ok) {
      location.href = '/';
      return;
    }
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setError(data?.error || 'Anmeldung fehlgeschlagen.');
    setLoading(false);
  }

  return <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-card p-6 shadow-2xl shadow-black/30 sm:p-8">
    <div className="mb-6 grid size-12 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-300"><LockKeyhole /></div>
    <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Privater Zugang</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight">SWU Sammler</h1>
    <p className="mt-2 text-sm leading-relaxed text-slate-400">Melde dich an, um deine Sammlung und gespeicherten Decks auf diesem Gerät zu öffnen.</p>
    <label htmlFor="password" className="mt-6 block text-sm font-medium text-slate-200">Passwort</label>
    <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 border-white/10 bg-[#0d1017]" />
    {error && <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/8 px-3 py-2 text-sm text-rose-200">{error}</p>}
    <Button type="submit" disabled={loading} className="mt-5 h-12 w-full bg-amber-300 font-bold text-slate-950 hover:bg-amber-200"><LogIn />{loading ? 'Anmeldung läuft …' : 'Anmelden'}</Button>
  </form>;
}
