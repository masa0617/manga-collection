import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Best-effort native orientation lock: only actually takes effect in a
// fullscreen/installed-standalone context on Chromium-based browsers - a
// plain browser tab (and Safari in general) silently rejects it, which is
// exactly why the CSS landscape guard in styles.css exists as the real,
// universal fallback. Cast to unknown/loose type since TS's DOM lib doesn't
// declare ScreenOrientation.lock (Safari also lacks the method entirely).
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> }
;(screen.orientation as LockableOrientation | undefined)?.lock?.('portrait')?.catch(() => {})
