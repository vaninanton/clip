import './styles.css'
import {connect, type FileHeader, type Net} from './net'
import {detectDevice, type Device} from './devices'
import {isFile, isText, newId, type Entry, type FileEntry, type TextEntry} from './entries'
import {createUI, type Status} from './ui'
import {randomRoomName} from './words'

const COPIED_MS = 1400
const DEBUG = new URLSearchParams(location.search).has('debug')

const me = detectDevice()

const readHash = (): string => {
  const raw = location.hash.slice(1)
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

const state = {
  room: readHash() || randomRoomName(),
  draft: '',
  entries: [] as Entry[],
  peers: new Map<string, Device>(),
  everConnected: false,
  copiedId: null as string | null,
  expanded: new Set<string>(),
  dragging: false
}

const status = (): Status =>
  state.peers.size > 0 ? 'work' : state.everConnected ? 'down' : 'waiting'

const ui = createUI({
  onRoomInput: value => {
    state.room = value
    writeHash()
    scheduleReopen()
    render()
  },
  onDraft: value => {
    state.draft = value
    render()
  },
  onSend: () => sendDraft(),
  onFiles: files => void sendFiles(files),
  onDragging: active => {
    if (state.dragging === active) return
    state.dragging = active
    render()
  },
  onPrimary: entry => void primary(entry),
  onResend: entry => void resend(entry),
  onDelete: id => {
    // Удаление локальное: чужой ленте мы не хозяева.
    state.entries = state.entries.filter(entry => entry.id !== id)
    render()
  },
  onToggleExpand: id => {
    if (state.expanded.has(id)) state.expanded.delete(id)
    else state.expanded.add(id)
    render()
  },
  onReconnect: () => void open()
})

const render = (): void =>
  ui.render({
    room: state.room,
    draft: state.draft,
    entries: state.entries,
    me,
    peers: [...state.peers.values()],
    status: status(),
    copiedId: state.copiedId,
    expanded: state.expanded,
    dragging: state.dragging
  })

function writeHash(): void {
  const next = `#${encodeURIComponent(state.room)}`
  if (location.hash !== next) history.replaceState(null, '', next)
}

/* ── соединение ───────────────────────────────────────────────────── */

let net: Net | null = null
let generation = 0
let reopenTimer: number | undefined
const pendingHistory: string[] = []

function scheduleReopen(): void {
  window.clearTimeout(reopenTimer)
  // Имя набирают руками, посимвольно переподключаться бессмысленно.
  reopenTimer = window.setTimeout(() => void open(), 600)
}

async function open(): Promise<void> {
  window.clearTimeout(reopenTimer)
  const gen = ++generation
  const previous = net
  net = null
  state.peers = new Map()
  state.everConnected = false
  pendingHistory.length = 0
  render()

  if (previous) {
    try {
      await previous.leave()
    } catch {
      // комната уже могла закрыться сама — для нас это тот же результат
    }
  }
  if (gen !== generation || !state.room.trim()) return

  let created: Net
  try {
    created = await connect(state.room, me, {
      onPeersChange: peers => {
        if (gen !== generation) return
        state.peers = peers
        if (peers.size > 0) state.everConnected = true
        render()
      },
      onText: (message, device) => {
        if (gen !== generation || state.entries.some(entry => entry.id === message.id)) return
        state.entries.unshift({
          id: message.id, at: message.at, mine: false, device, kind: 'text', body: message.body
        })
        render()
      },
      onFileProgress: (header, percent, device) => {
        if (gen !== generation) return
        const entry = ensureFileEntry(header, device)
        entry.progress = percent
        entry.speed = trackSpeed(entry.id, header.size * percent) ?? entry.speed
        render()
      },
      onFile: (header, blob, device) => {
        if (gen !== generation) return
        const entry = ensureFileEntry(header, device)
        entry.blob = blob
        entry.progress = null
        entry.speed = null
        speedMarks.delete(entry.id)
        render()
      },
      onPeerJoin: peerId => {
        if (gen !== generation) return
        if (net) void pushHistory(net, peerId)
        else pendingHistory.push(peerId)
      }
    })
  } catch (error) {
    // Чаще всего это недоступный релей или отсутствующий crypto.subtle
    // в небезопасном контексте. Молча зависнуть в «ждём устройство» хуже,
    // чем оставить след в консоли.
    console.error('не удалось войти в комнату', error)
    return
  }

  if (gen !== generation) {
    void created.leave()
    return
  }
  net = created
  for (const peerId of pendingHistory.splice(0)) void pushHistory(created, peerId)
  render()

  if (DEBUG) {
    Object.assign(window, {__clip: {state, net: () => net, relays: () => created.relays()}})
    window.setTimeout(() => {
      const relays = created.relays()
      const open = relays.filter(relay => relay.open)
      console.info(
        `релеи: открыто ${open.length} из ${relays.length}`,
        relays.map(relay => `${relay.open ? '+' : '-'} ${relay.url}`)
      )
    }, 6000)
  }
}

/** Пир пришёл позже — отдаём ему то, что мы уже отправляли в эту комнату. */
async function pushHistory(current: Net, peerId: string): Promise<void> {
  for (const entry of [...state.entries].reverse()) {
    if (!entry.mine) continue
    try {
      if (isText(entry)) {
        await current.sendText({id: entry.id, at: entry.at, body: entry.body}, peerId)
      } else if (entry.blob) {
        await current.sendFile(headerOf(entry), entry.blob, {target: peerId})
      }
    } catch {
      return // пир отвалился на полпути — остальное не имеет смысла
    }
  }
}

/* ── записи ───────────────────────────────────────────────────────── */

const headerOf = (entry: FileEntry): FileHeader => ({
  id: entry.id, at: entry.at, name: entry.name, size: entry.size, mime: entry.mime
})

function ensureFileEntry(header: FileHeader, device: Device): FileEntry {
  const existing = state.entries.find(entry => entry.id === header.id)
  if (existing && isFile(existing)) return existing
  const entry: FileEntry = {
    id: header.id, at: header.at, mine: false, device, kind: 'file',
    name: header.name, size: header.size, mime: header.mime,
    blob: null, progress: 0, speed: null
  }
  state.entries.unshift(entry)
  return entry
}

const speedMarks = new Map<string, {at: number; loaded: number}>()

function trackSpeed(id: string, loaded: number): number | null {
  const now = performance.now()
  const previous = speedMarks.get(id)
  speedMarks.set(id, {at: now, loaded})
  if (!previous) return null
  const seconds = (now - previous.at) / 1000
  const delta = loaded - previous.loaded
  return seconds > 0.05 && delta > 0 ? delta / seconds : null
}

function sendDraft(): void {
  const body = state.draft.trim()
  if (!body || !net) return
  const entry: TextEntry = {id: newId(), at: Date.now(), mine: true, device: me, kind: 'text', body}
  state.entries.unshift(entry)
  state.draft = ''
  render()
  void net.sendText({id: entry.id, at: entry.at, body})
}

async function sendFiles(files: File[]): Promise<void> {
  for (const file of files) {
    const entry: FileEntry = {
      id: newId(), at: Date.now(), mine: true, device: me, kind: 'file',
      name: file.name, size: file.size, mime: file.type || 'application/octet-stream',
      blob: file, progress: net ? 0 : null, speed: null
    }
    state.entries.unshift(entry)
    render()
    if (!net) continue
    await transfer(net, entry)
  }
}

async function transfer(current: Net, entry: FileEntry, target?: string): Promise<void> {
  entry.progress = 0
  entry.speed = null
  render()
  try {
    await current.sendFile(headerOf(entry), entry.blob as Blob, {
      ...(target === undefined ? {} : {target}),
      onProgress: percent => {
        entry.progress = percent
        entry.speed = trackSpeed(entry.id, entry.size * percent) ?? entry.speed
        render()
      }
    })
  } finally {
    entry.progress = null
    entry.speed = null
    speedMarks.delete(entry.id)
    render()
  }
}

async function resend(entry: Entry): Promise<void> {
  if (!net) return
  state.entries = [entry, ...state.entries.filter(item => item.id !== entry.id)]
  entry.at = Date.now()
  render()
  if (isText(entry)) await net.sendText({id: entry.id, at: entry.at, body: entry.body})
  else if (entry.blob) await transfer(net, entry)
}

async function primary(entry: Entry): Promise<void> {
  if (isText(entry)) await copyText(entry.body)
  else if (entry.blob) saveBlob(entry.name, entry.blob)
  else return
  state.copiedId = entry.id
  render()
  window.setTimeout(() => {
    if (state.copiedId !== entry.id) return
    state.copiedId = null
    render()
  }, COPIED_MS)
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Clipboard API может быть запрещён политикой или отсутствовать —
    // ниже старый способ, он работает без разрешений, но требует DOM.
  }
  const holder = document.createElement('textarea')
  holder.value = text
  holder.setAttribute('readonly', '')
  holder.style.cssText = 'position:fixed;top:-1000px;opacity:0'
  document.body.appendChild(holder)
  holder.select()
  try {
    document.execCommand('copy')
  } catch {
    // ничего не поделать: пользователь выделит и скопирует руками
  }
  holder.remove()
}

function saveBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/* ── запуск ───────────────────────────────────────────────────────── */

window.addEventListener('hashchange', () => {
  const room = readHash()
  if (!room || room === state.room) return
  state.room = room
  void open()
  render()
})

document.getElementById('app')?.replaceChildren(ui.root)
writeHash()
render()
void open()
