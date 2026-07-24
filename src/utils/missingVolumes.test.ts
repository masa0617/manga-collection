import { describe, expect, it } from 'vitest'
import { getMissingVolumes } from './missingVolumes'

describe('getMissingVolumes', () => {
  it('returns nothing for a complete run', () => {
    expect(getMissingVolumes([1, 2, 3, 4])).toEqual([])
  })

  it('finds a single gap in the middle', () => {
    expect(getMissingVolumes([1, 2, 4, 5])).toEqual([3])
  })

  it('finds multiple gaps', () => {
    expect(getMissingVolumes([1, 5, 8])).toEqual([2, 3, 4, 6, 7])
  })

  it('returns nothing for a single volume that is volume 1', () => {
    expect(getMissingVolumes([1])).toEqual([])
  })

  it('returns nothing for an empty list', () => {
    expect(getMissingVolumes([])).toEqual([])
  })

  // Regression: a collection that starts at volume 2 (volume 1 was never
  // registered - out of print, bought used missing the first book, etc.) is
  // a gap in its own right and must be flagged even though every owned
  // volume from the lowest one up is contiguous. A min..max sweep can never
  // see this since the lowest owned volume trivially satisfies its own lower
  // bound - the sweep must always start at 1, not at the lowest owned volume.
  it('flags volume 1 as missing when the collection starts at volume 2', () => {
    expect(getMissingVolumes([2, 3, 4])).toEqual([1])
    expect(getMissingVolumes([7])).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('order of input does not matter', () => {
    expect(getMissingVolumes([5, 1, 4, 2])).toEqual([3])
  })

  // Regression: a duplicate volumeNumber (double-scan, or two different
  // ISBNs mis-parsed to the same number - see AddScreen's duplicate guard)
  // must not hide a real gap elsewhere in the run.
  it('does not let a duplicate volume number mask a real gap', () => {
    expect(getMissingVolumes([1, 1, 2])).toEqual([])
    expect(getMissingVolumes([1, 2, 2, 5])).toEqual([3, 4])
  })

  // Regression: legacy data saved before AddScreen's Number.isInteger check
  // existed (or any other source of a non-integer volumeNumber) must not
  // break the gap sweep - see normalizeVolumeNumber.
  it('is robust to non-integer volume numbers from legacy data', () => {
    expect(getMissingVolumes([1, 2.4, 3])).toEqual([])
    // Math.round(3.6) === 4, so this normalizes to [1, 4, 5] - missing 2, 3.
    expect(getMissingVolumes([1, 3.6, 5])).toEqual([2, 3])
  })
})
