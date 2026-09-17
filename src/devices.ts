export type OsKey = 'windows' | 'macos' | 'ios' | 'linux' | 'android' | 'other'
export type BrowserKey = 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'other'
export type Device = {os: OsKey; browser: BrowserKey}

type Look = {icon: string; label: string}

const SYSTEMS: Record<OsKey, Look> = {
  windows: {icon: 'fa-brands fa-windows', label: 'Windows'},
  macos: {icon: 'fa-brands fa-apple', label: 'macOS'},
  ios: {icon: 'fa-brands fa-apple', label: 'iOS'},
  linux: {icon: 'fa-brands fa-linux', label: 'Linux'},
  android: {icon: 'fa-brands fa-android', label: 'Android'},
  other: {icon: 'fa-solid fa-desktop', label: 'система'}
}

const BROWSERS: Record<BrowserKey, Look> = {
  chrome: {icon: 'fa-brands fa-chrome', label: 'Chrome'},
  firefox: {icon: 'fa-brands fa-firefox', label: 'Firefox'},
  safari: {icon: 'fa-brands fa-safari', label: 'Safari'},
  edge: {icon: 'fa-brands fa-edge', label: 'Edge'},
  opera: {icon: 'fa-brands fa-opera', label: 'Opera'},
  other: {icon: 'fa-solid fa-globe', label: 'браузер'}
}

export function detectDevice(): Device {
  const ua = navigator.userAgent
  return {
    // Порядок важен: Edge и Opera тоже пишут о себе Chrome,
    // а Chrome вдобавок представляется Safari.
    browser: /Edg\//.test(ua) ? 'edge'
      : /OPR\/|Opera/.test(ua) ? 'opera'
      : /Firefox\/|FxiOS/.test(ua) ? 'firefox'
      : /Chrome\/|CriOS/.test(ua) ? 'chrome'
      : /Safari\//.test(ua) ? 'safari'
      : 'other',
    os: detectOs(ua)
  }
}

function detectOs(ua: string): OsKey {
  if (/Windows/.test(ua)) return 'windows'
  if (/Android/.test(ua)) return 'android'
  if (/iPhone|iPod|iPad/.test(ua)) return 'ios'
  if (/Macintosh|Mac OS X/.test(ua)) {
    // iPadOS с 13-й версии представляется маком и по строке User-Agent
    // неотличим от него. Выдаёт его сенсорный экран: у настольных маков
    // maxTouchPoints равен нулю, у планшета — пяти.
    return navigator.maxTouchPoints > 1 ? 'ios' : 'macos'
  }
  if (/Linux|X11/.test(ua)) return 'linux'
  return 'other'
}

/**
 * Данные от чужого пира недоверенные: по сети ходят только ключи,
 * а CSS-классы берутся из таблиц здесь. Неизвестный ключ схлопывается в other.
 */
export function normalizeDevice(input: unknown): Device {
  const raw = (input ?? {}) as Record<string, unknown>
  const os = raw['os']
  const browser = raw['browser']
  return {
    os: typeof os === 'string' && Object.hasOwn(SYSTEMS, os) ? (os as OsKey) : 'other',
    browser: typeof browser === 'string' && Object.hasOwn(BROWSERS, browser) ? (browser as BrowserKey) : 'other'
  }
}

export const osLook = (device: Device): Look => SYSTEMS[device.os]
export const browserLook = (device: Device): Look => BROWSERS[device.browser]
export const deviceTag = (device: Device): string => `${SYSTEMS[device.os].label} · ${BROWSERS[device.browser].label}`
