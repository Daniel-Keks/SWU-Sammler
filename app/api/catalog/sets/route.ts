const SOURCE = 'https://api.swu-db.com/sets';

type SourceSet = {
  setId: string;
  fullName: string;
  numberCards: number;
  releaseDate?: string;
  parentSetId?: string;
  isBaseSet?: boolean;
};

const PRERELEASE_SETS: SourceSet[] = [
  { setId: 'HMW', fullName: 'Homeworlds', numberCards: 277, releaseDate: '10/9/26', isBaseSet: true },
];

export const revalidate = 21600;

export async function GET() {
  const response = await fetch(SOURCE, { headers: { accept: 'application/json' }, next: { revalidate } });
  if (!response.ok) return Response.json({ error: 'Kartensets konnten nicht geladen werden' }, { status: 502 });
  const source = await response.json() as SourceSet[];
  const today = Date.now();
  const prereleaseWindow = today + 7 * 24 * 60 * 60 * 1000;
  const available = [...source];
  for (const set of PRERELEASE_SETS) {
    const existing = available.find((candidate) => candidate.setId === set.setId);
    if (existing) Object.assign(existing, { ...set, numberCards: Math.max(existing.numberCards, set.numberCards) });
    else available.push(set);
  }
  const sets = available
    .filter((set) => !set.releaseDate || new Date(set.releaseDate).getTime() <= prereleaseWindow)
    .map((set) => ({ code: set.setId, name: set.fullName, cardCount: set.numberCards, releaseDate: set.releaseDate ?? null, parent: set.parentSetId ?? null, isBase: set.isBaseSet ?? false }))
    .sort((a, b) => {
      const dateDifference = (b.releaseDate ? new Date(b.releaseDate).getTime() : 0) - (a.releaseDate ? new Date(a.releaseDate).getTime() : 0);
      return dateDifference || Number(b.isBase) - Number(a.isBase) || a.name.localeCompare(b.name);
    });
  return Response.json({ sets, totalCards: sets.reduce((sum, set) => sum + set.cardCount, 0), source: 'SWU-DB' });
}
