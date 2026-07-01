interface Props {
  onClick: () => void
}

export default function BackupBanner({ onClick }: Props) {
  return (
    <button className="backup-banner" onClick={onClick}>
      バックアップしてください（タップして書き出し）
    </button>
  )
}
