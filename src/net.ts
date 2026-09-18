import {getRelaySockets, joinRoom} from '@trystero-p2p/ws-relay'
import type {JsonValue} from '@trystero-p2p/ws-relay'
import {normalizeDevice, type Device} from './devices'

const APP_ID = 'vanton-clipboard'

// Релей живёт на том же адресе, что и страница, поэтому настраивать
// его не нужно: адрес выводится из текущего origin. Переопределение
// через VITE_RELAY_URL нужно только для локальной разработки,
// когда страницу отдаёт vite dev server, а релей — контейнер.
const RELAY_URL: string =
  import.meta.env['VITE_RELAY_URL'] ??
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay`
const UNKNOWN: Device = {os: 'other', browser: 'other'}

export type TextMessage = {id: string; at: number; body: string}
export type FileHeader = {id: string; at: number; name: string; size: number; mime: string}

export type NetHandlers = {
  onPeersChange: (peers: Map<string, Device>) => void
  onText: (message: TextMessage, device: Device) => void
  onFileProgress: (header: FileHeader, percent: number, device: Device) => void
  onFile: (header: FileHeader, blob: Blob, device: Device) => void
  /** Пир подключился — самое время отдать ему то, что уже лежит в ленте. */
  onPeerJoin: (peerId: string) => void
}

export type RelayState = {url: string; readyState: number; open: boolean}

export type Net = {
  peers: () => Map<string, Device>
  /** Состояние подключений к сигнальным релеям — для диагностики. */
  relays: () => RelayState[]
  sendText: (message: TextMessage, target?: string) => Promise<void>
  sendFile: (header: FileHeader, blob: Blob, options?: SendFileOptions) => Promise<void>
  leave: () => Promise<void>
}

type SendFileOptions = {target?: string; onProgress?: (percent: number) => void}

/**
 * Имя комнаты человек набирает руками, а по сети уходит его хеш:
 * релей видит идентификатор, но не сам секрет. Секрет при этом
 * работает паролем, которым trystero шифрует обмен SDP.
 */
async function roomIdFor(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** Всё, что пришло от чужого пира, — недоверенный ввод. */
function readText(data: unknown): TextMessage | null {
  const raw = (data ?? {}) as Record<string, unknown>
  const id = str(raw['id'])
  const body = str(raw['body'])
  const at = num(raw['at'])
  return id && body !== null ? {id, body, at: at ?? Date.now()} : null
}

function readHeader(data: unknown): FileHeader | null {
  const raw = (data ?? {}) as Record<string, unknown>
  const id = str(raw['id'])
  const name = str(raw['name'])
  const size = num(raw['size'])
  const at = num(raw['at'])
  if (!id || !name) return null
  return {
    id,
    name,
    size: size ?? 0,
    mime: str(raw['mime']) ?? 'application/octet-stream',
    at: at ?? Date.now()
  }
}

export async function connect(secret: string, me: Device, handlers: NetHandlers): Promise<Net> {
  const room = joinRoom(
    {appId: APP_ID, password: secret, relayConfig: {urls: [RELAY_URL]}},
    await roomIdFor(secret)
  )
  const peers = new Map<string, Device>()
  const publish = (): void => handlers.onPeersChange(new Map(peers))
  const deviceOf = (peerId: string): Device => peers.get(peerId) ?? UNKNOWN

  const hello = room.makeAction<JsonValue>('hello', {
    onMessage: (data, {peerId}) => {
      if (!peers.has(peerId)) return
      peers.set(peerId, normalizeDevice(data))
      publish()
    }
  })

  const text = room.makeAction<JsonValue>('text', {
    onMessage: (data, {peerId}) => {
      const message = readText(data)
      if (message) handlers.onText(message, deviceOf(peerId))
    }
  })

  const file = room.makeAction<ArrayBuffer>('file', {
    onMessage: (data, {peerId, metadata}) => {
      const header = readHeader(metadata)
      if (header) handlers.onFile(header, new Blob([data], {type: header.mime}), deviceOf(peerId))
    },
    onReceiveProgress: (percent, {peerId, metadata}) => {
      const header = readHeader(metadata)
      if (header) handlers.onFileProgress(header, percent, deviceOf(peerId))
    }
  })

  room.onPeerJoin = peerId => {
    // Устройство пира ещё неизвестно — до ответа hello рисуем заглушки.
    peers.set(peerId, UNKNOWN)
    publish()
    void hello.send(me, {target: peerId})
    handlers.onPeerJoin(peerId)
  }

  room.onPeerLeave = peerId => {
    peers.delete(peerId)
    publish()
  }

  return {
    peers: () => new Map(peers),
    relays: () =>
      Object.entries(getRelaySockets() as Record<string, {readyState: number}>).map(
        ([url, socket]) => ({url, readyState: socket.readyState, open: socket.readyState === 1})
      ),
    sendText: (message, target) => text.send(message, target === undefined ? {} : {target}),
    sendFile: async (header, blob, options = {}) => {
      const buffer = await blob.arrayBuffer()
      await file.send(buffer, {
        metadata: header,
        ...(options.target === undefined ? {} : {target: options.target}),
        ...(options.onProgress === undefined ? {} : {onProgress: options.onProgress})
      })
    },
    leave: () => room.leave()
  }
}
