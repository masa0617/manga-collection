// Rounded to the nearest integer defensively - AddScreen requires an integer
// at entry (see its Number.isInteger check), but this guards against any
// pre-existing non-integer/stringly-typed volumeNumber already sitting in a
// device's IndexedDB from before that check existed, which would otherwise
// silently break the Set membership test below (e.g. a stored "3" string
// never matching the integer 3 the min..max loop generates) and hide a real
// gap instead of just misreporting one.
function normalizeVolumeNumber(n: number): number {
  return Math.round(Number(n))
}

// Sweeps from volume 1 (not the lowest owned volume) up to the highest owned
// volume: a collection that starts at 2 because volume 1 was never
// registered is exactly the kind of gap this is meant to catch, and a
// min..max sweep can never see it since the lowest owned volume always
// trivially satisfies its own lower bound.
export function getMissingVolumes(volumeNumbers: number[]): number[] {
  if (volumeNumbers.length === 0) return []
  const normalized = volumeNumbers.map(normalizeVolumeNumber)
  const max = Math.max(...normalized)
  const owned = new Set(normalized)
  const missing: number[] = []
  for (let n = 1; n <= max; n++) {
    if (!owned.has(n)) missing.push(n)
  }
  return missing
}
