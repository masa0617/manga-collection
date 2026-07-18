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

export function getMissingVolumes(volumeNumbers: number[]): number[] {
  if (volumeNumbers.length === 0) return []
  const normalized = volumeNumbers.map(normalizeVolumeNumber)
  const min = Math.min(...normalized)
  const max = Math.max(...normalized)
  const owned = new Set(normalized)
  const missing: number[] = []
  for (let n = min; n <= max; n++) {
    if (!owned.has(n)) missing.push(n)
  }
  return missing
}
