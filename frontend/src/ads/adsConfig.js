/**
 * Adsterra ad configuration — the single place every ad unit key lives.
 *
 * Ads are shown ONLY when all of these hold:
 *   • this is a production build            (never in `npm run dev`)
 *   • we are NOT inside the Android app     (the WebView shell; see IS_ANDROID)
 *   • the page is served from an approved host
 * The host check matters: Adsterra only serves approved domains, and loading ads
 * on localhost / preview builds risks accidental self-clicks, which is the most
 * common reason publisher accounts get frozen.
 */
import { IS_ANDROID } from '../config'

// Hosts Adsterra has approved. Add a custom domain here once you have one.
// For a local test of a production build you can add hosts at build time with
// VITE_ADS_EXTRA_HOSTS=localhost (never commit that to .env.production).
const EXTRA_HOSTS = (import.meta.env.VITE_ADS_EXTRA_HOSTS || '')
  .split(',').map((h) => h.trim()).filter(Boolean)

export const ADS_HOSTS = ['wmc-virtual-lab.onrender.com', ...EXTRA_HOSTS]

export const ADS_ENABLED =
  import.meta.env.PROD &&
  !IS_ANDROID &&
  typeof window !== 'undefined' &&
  ADS_HOSTS.includes(window.location.hostname)

/** Site-wide script ads: Social Bar and Popunder. Loaded once per page load. */
export const GLOBAL_AD_SCRIPTS = [
  'https://bauval.org/14/f3d5c2b4db95d96f6c4eb09ed9c53698',   // Social Bar
  'https://abscloud.org/1/fef5eeda683700adf66cec8a95a567bc',  // Popunder
]

/**
 * Native Banner units — rendered in-page (they size themselves). A unit's
 * container id must be unique on a page, so each unit can be used ONCE per page.
 * To add more native placements: create another Native Banner unit in the
 * Adsterra dashboard and append its { src, containerId } here.
 */
export const NATIVE_UNITS = [
  {
    src: 'https://bauval.org/21/672f3a387ac4d8d89e4cc00042cab9f1',
    containerId: 'container-672f3a387ac4d8d89e4cc00042cab9f1',
  },
]

/** Fixed-size iframe banners. */
export const BANNER_UNITS = {
  rectangle: { // 300x250
    key: '7127e68d6a6df2c5d166f59c9e7340fc', width: 300, height: 250,
    src: 'https://bauval.org/22/7127e68d6a6df2c5d166f59c9e7340fc',
  },
  leaderboard: { // 728x90 (desktop)
    key: 'ad763be639a42bc057c6fc02a189b7c9', width: 728, height: 90,
    src: 'https://bauval.org/22/ad763be639a42bc057c6fc02a189b7c9',
  },
  mobile: { // 320x50 (phones)
    key: 'ef97c22dbeb9ac5ead0e64306410e661', width: 320, height: 50,
    src: 'https://bauval.org/22/ef97c22dbeb9ac5ead0e64306410e661',
  },
}
