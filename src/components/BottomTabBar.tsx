export type MainTab = 'home' | 'wishlist'

interface Props {
  active: MainTab
  onChange: (tab: MainTab) => void
}

export default function BottomTabBar({ active, onChange }: Props) {
  return (
    <nav className="bottom-tabbar">
      <button
        className={active === 'home' ? 'bottom-tab bottom-tab--active' : 'bottom-tab'}
        onClick={() => onChange('home')}
      >
        蔵書
      </button>
      <button
        className={active === 'wishlist' ? 'bottom-tab bottom-tab--active' : 'bottom-tab'}
        onClick={() => onChange('wishlist')}
      >
        ほしいものリスト
      </button>
    </nav>
  )
}
