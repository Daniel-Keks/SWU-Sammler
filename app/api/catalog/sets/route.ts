const SOURCE = 'https://api.swu-db.com/sets';

type SourceSet = {
  setId: string;
  fullName: string;
  numberCards: number;
  releaseDate?: string;
  parentSetId?: string;
};

export const revalidate = 21600;

export async function GET() {
  const response = await fetch(SOURCE, { headers: { accept: 'application/json' }, next: { revalidate } });
  if (!response.ok) return Response.json({ error: 'Kartensets konnten nicht geladen werden' }, { status: 502 });
  const source = await response.json() as SourceSet[];
  const today = Date.now();
  const sets = source
    .filter((set) => !set.releaseDate || new Date(set.releaseDate).getTime() <= today)
    .map((set) => ({ code: set.setId, name: set.fullName, cardCount: set.numberCards, releaseDate: set.releaseDate ?? null, parent: set.parentSetId ?? null }))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || a.name.localeCompare(b.name));
  return Response.json({ sets, totalCards: sets.reduce((sum, set) => sum + set.cardCount, 0), source: 'SWU-DB' });
}
