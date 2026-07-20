import { describe, expect, it } from 'vitest'
import type { Series, Volume } from '../types'
import { getUpcomingRelease, hasNewRelease } from './newRelease'

function isoDaysFromNow(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function series(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    name: 'テスト',
    author: '著者',
    createdAt: 0,
    ...overrides,
  }
}

function ownedVolumes(max: number): Volume[] {
  return Array.from({ length: max }, (_, i) => ({
    id: `v${i + 1}`,
    seriesId: 's1',
    volumeNumber: i + 1,
    createdAt: 0,
  }))
}

describe('getUpcomingRelease (予約 badge)', () => {
  it('shows within 3 weeks (21 days) before the release date', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(21) })
    expect(getUpcomingRelease(s, ownedVolumes(10))).toEqual({ volumeNumber: 11, dateISO: isoDaysFromNow(21) })
  })

  it('does not show more than 3 weeks before the release date', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(22) })
    expect(getUpcomingRelease(s, ownedVolumes(10))).toBeNull()
  })

  it('does not show once the release date has passed (becomes 新刊 territory instead)', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(-1) })
    expect(getUpcomingRelease(s, ownedVolumes(10))).toBeNull()
  })

  it('does not show when the next volume is already registered', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(5) })
    expect(getUpcomingRelease(s, ownedVolumes(11))).toBeNull()
  })

  it('does not show for a completed series', () => {
    const s = series({
      estimatedTotalVolumeCount: 11,
      estimatedLatestReleaseDateISO: isoDaysFromNow(5),
      isCompleted: true,
    })
    expect(getUpcomingRelease(s, ownedVolumes(10))).toBeNull()
  })
})

describe('hasNewRelease (新刊 badge)', () => {
  it('shows the moment the release date passes', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(0) })
    expect(hasNewRelease(s, ownedVolumes(10))).toBe(true)
  })

  it('keeps showing long after release with no time-based expiry, as long as unregistered', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(-90) })
    expect(hasNewRelease(s, ownedVolumes(10))).toBe(true)
  })

  it('stops once the volume is registered (total count matches owned max)', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(-90) })
    expect(hasNewRelease(s, ownedVolumes(11))).toBe(false)
  })

  it('does not show before the release date (that is 予約 territory instead)', () => {
    const s = series({ estimatedTotalVolumeCount: 11, estimatedLatestReleaseDateISO: isoDaysFromNow(5) })
    expect(hasNewRelease(s, ownedVolumes(10))).toBe(false)
  })

  it('does not show for a completed series', () => {
    const s = series({
      estimatedTotalVolumeCount: 11,
      estimatedLatestReleaseDateISO: isoDaysFromNow(-90),
      isCompleted: true,
    })
    expect(hasNewRelease(s, ownedVolumes(10))).toBe(false)
  })
})
