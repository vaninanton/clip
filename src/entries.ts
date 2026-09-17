import type {Device} from './devices'
import {bytes} from './format'

type Common = {
  id: string
  at: number
  mine: boolean
  device: Device
}

export type TextEntry = Common & {
  kind: 'text'
  body: string
}

export type FileEntry = Common & {
  kind: 'file'
  name: string
  size: number
  mime: string
  /** Готовый файл. Пока идёт передача — null. */
  blob: Blob | null
  /** 0..1 во время передачи, иначе null. */
  progress: number | null
  /** Байт в секунду, считается по приращениям прогресса. */
  speed: number | null
}

export type Entry = TextEntry | FileEntry

export const isText = (entry: Entry): entry is TextEntry => entry.kind === 'text'
export const isFile = (entry: Entry): entry is FileEntry => entry.kind === 'file'
export const isTransferring = (entry: Entry): boolean => isFile(entry) && entry.progress !== null

export const newId = (): string => crypto.randomUUID()

export function fileMeta(entry: FileEntry): string {
  const type = entry.mime || 'application/octet-stream'
  const state = entry.progress !== null ? 'передаётся'
    : entry.blob ? (entry.mine ? 'отправлен' : 'получен полностью')
    : 'файл недоступен'
  return `${bytes(entry.size)} · ${type} · ${state}`
}
