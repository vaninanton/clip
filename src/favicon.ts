/**
 * Иконка вкладки рисуется в canvas: эмодзи плюс красная точка, когда
 * пришло непрочитанное. SVG-фавиконку поддерживают не все браузеры,
 * а PNG из canvas понимают везде.
 */
const GLYPH = '🗒️'
const SIZE = 64

const EMOJI_FONT =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

const cache = new Map<boolean, string>()

function draw(badge: boolean): string {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.font = `${SIZE * 0.8}px ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(GLYPH, SIZE / 2, SIZE / 2 + SIZE * 0.04)

  if (badge) {
    ctx.beginPath()
    ctx.arc(SIZE - 17, 17, 14, 0, Math.PI * 2)
    ctx.fillStyle = '#e5484d'
    ctx.fill()
    // Белая обводка отделяет точку от эмодзи под ней: без неё на тёмной
    // панели вкладок они сливаются.
    ctx.lineWidth = 4
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  }

  return canvas.toDataURL('image/png')
}

function iconFor(badge: boolean): string {
  const cached = cache.get(badge)
  if (cached !== undefined) return cached
  const url = draw(badge)
  cache.set(badge, url)
  return url
}

let unread = false

function apply(): void {
  const url = iconFor(unread)
  if (!url) return
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.append(link)
  }
  link.href = url
}

/**
 * Вкладку считаем невидимой не только когда она свёрнута, но и когда
 * окно просто потеряло фокус: браузер рядом с окном RDP остаётся
 * видимым, а человек в него не смотрит.
 */
const away = (): boolean => document.hidden || !document.hasFocus()

export function markUnread(): void {
  if (unread || !away()) return
  unread = true
  apply()
}

function clear(): void {
  if (!unread || away()) return
  unread = false
  apply()
}

export function initFavicon(): void {
  apply()
  document.addEventListener('visibilitychange', clear)
  window.addEventListener('focus', clear)
}
