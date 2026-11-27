/** Units come from a database enum: keep abbreviations short, pluralise whole words. */
export function unitLabel(unit: string, count: number): string {
  const word = unit.toLowerCase();
  return count === 1 || word.length <= 3 ? word : `${word}s`;
}
