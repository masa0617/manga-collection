import type { BackupMeta } from '../types'

const BACKUP_DAYS_THRESHOLD = 7
const BACKUP_COUNT_THRESHOLD = 5

export function shouldPromptBackup(meta: BackupMeta): boolean {
  const daysSince = (Date.now() - meta.lastBackupAt) / (1000 * 60 * 60 * 24)
  return daysSince >= BACKUP_DAYS_THRESHOLD || meta.addedSinceBackup >= BACKUP_COUNT_THRESHOLD
}

export async function shareOrDownloadJson(data: unknown, filenamePrefix: string): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`
  const blob = new Blob([json], { type: 'application/json' })
  const file = new File([blob], filename, { type: 'application/json' })

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'マンガ棚バックアップ' })
      return
    } catch {
      // user cancelled share sheet or share failed; fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
