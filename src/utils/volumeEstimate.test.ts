import { describe, expect, it } from 'vitest'
import { getDisplayTotalVolumeCount, getOwnedMaxVolume, isValidEstimatedTotal } from './volumeEstimate'

const vol = (n: number) => ({ volumeNumber: n })

describe('getOwnedMaxVolume', () => {
  it('returns the highest owned volume number', () => {
    expect(getOwnedMaxVolume([vol(1), vol(3), vol(2)])).toBe(3)
  })

  it('returns 0 for no volumes', () => {
    expect(getOwnedMaxVolume([])).toBe(0)
  })
})

describe('isValidEstimatedTotal', () => {
  it('rejects undefined, 0, and anything below the owned max', () => {
    expect(isValidEstimatedTotal(undefined, 0)).toBe(false)
    expect(isValidEstimatedTotal(0, 0)).toBe(false)
    expect(isValidEstimatedTotal(2, 5)).toBe(false)
  })

  it('accepts a positive total at or above the owned max', () => {
    expect(isValidEstimatedTotal(5, 5)).toBe(true)
    expect(isValidEstimatedTotal(12, 5)).toBe(true)
  })
})

describe('getDisplayTotalVolumeCount', () => {
  it('never displays a manual total below the owned max (the reported "全2巻中12巻" bug)', () => {
    const series = { manualTotalVolumeCount: 2, estimatedTotalVolumeCount: undefined }
    const volumes = [vol(1), vol(2), vol(3), vol(4), vol(5), vol(6), vol(7), vol(8), vol(9), vol(10), vol(11), vol(12)]
    expect(getDisplayTotalVolumeCount(series, volumes)).toBe(12)
  })

  it('shows the manual total as-is when it is not contradicted', () => {
    const series = { manualTotalVolumeCount: 20, estimatedTotalVolumeCount: undefined }
    expect(getDisplayTotalVolumeCount(series, [vol(1), vol(2)])).toBe(20)
  })

  it('falls back to a valid estimate when no manual value is set', () => {
    const series = { manualTotalVolumeCount: undefined, estimatedTotalVolumeCount: 10 }
    expect(getDisplayTotalVolumeCount(series, [vol(1), vol(2)])).toBe(10)
  })

  it('hides an invalid (too-low) estimate rather than showing a contradiction', () => {
    const series = { manualTotalVolumeCount: undefined, estimatedTotalVolumeCount: 2 }
    expect(getDisplayTotalVolumeCount(series, [vol(1), vol(2), vol(3)])).toBeUndefined()
  })

  it('shows nothing when neither manual nor estimate is set', () => {
    const series = { manualTotalVolumeCount: undefined, estimatedTotalVolumeCount: undefined }
    expect(getDisplayTotalVolumeCount(series, [vol(1)])).toBeUndefined()
  })
})
