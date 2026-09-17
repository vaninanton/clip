const plural = (n: number, one: string, few: string, many: string): string => {
  if (n % 100 >= 11 && n % 100 <= 14) return many
  const last = n % 10
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export const devicesWord = (n: number): string => plural(n, 'устройство', 'устройства', 'устройств')
export const linesWord = (n: number): string => plural(n, 'строка', 'строки', 'строк')
export const entriesWord = (n: number): string => plural(n, 'запись', 'записи', 'записей')

const ru = (value: number, digits: number): string =>
  value.toLocaleString('ru-RU', {minimumFractionDigits: digits, maximumFractionDigits: digits})

const UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const

export function bytes(size: number): string {
  let value = size
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${ru(value, unit === 0 ? 0 : 1)} ${UNITS[unit]}`
}

export const speed = (bytesPerSecond: number): string => `≈ ${bytes(bytesPerSecond)}/с`

export function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
