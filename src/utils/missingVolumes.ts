export function getMissingVolumes(volumeNumbers: number[]): number[] {
  if (volumeNumbers.length === 0) return []
  const min = Math.min(...volumeNumbers)
  const max = Math.max(...volumeNumbers)
  const owned = new Set(volumeNumbers)
  const missing: number[] = []
  for (let n = min; n <= max; n++) {
    if (!owned.has(n)) missing.push(n)
  }
  return missing
}
