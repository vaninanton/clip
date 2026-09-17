/**
 * Имя комнаты одновременно является паролем, поэтому список намеренно
 * длинный: три слова из 168 дают порядка 4,7 млн сочетаний. Слова короткие,
 * без омофонов и удвоенных букв — их переписывают глазами с соседнего экрана.
 */
const WORDS = [
  'amber', 'anchor', 'apple', 'arch', 'arrow', 'ash', 'aspen', 'atlas',
  'basil', 'beacon', 'bear', 'birch', 'bison', 'blaze', 'bloom', 'brass',
  'breeze', 'brick', 'bridge', 'bronze', 'brook', 'cabin', 'cactus', 'canyon',
  'cedar', 'chalk', 'cherry', 'clay', 'cliff', 'clover', 'cobalt', 'comet',
  'copper', 'coral', 'cove', 'crane', 'creek', 'crest', 'crown', 'dawn',
  'delta', 'desert', 'dune', 'dusk', 'eagle', 'east', 'ember', 'fable',
  'falcon', 'fern', 'field', 'flame', 'flint', 'forest', 'fox', 'frost',
  'garnet', 'glade', 'grove', 'harbor', 'haven', 'hazel', 'heron', 'hill',
  'honey', 'indigo', 'iris', 'island', 'ivory', 'jade', 'kite', 'lake',
  'lamp', 'lantern', 'lark', 'laurel', 'lemon', 'lily', 'linen', 'lotus',
  'lunar', 'lynx', 'maple', 'marble', 'meadow', 'mesa', 'mint', 'mist',
  'moss', 'north', 'oak', 'ocean', 'olive', 'onyx', 'opal', 'orbit',
  'orchid', 'otter', 'owl', 'palm', 'pearl', 'pebble', 'petal', 'pine',
  'plum', 'pond', 'poppy', 'quartz', 'quill', 'rain', 'raven', 'reef',
  'ridge', 'river', 'robin', 'rose', 'ruby', 'rust', 'sage', 'sail',
  'sand', 'shade', 'shore', 'silver', 'sky', 'slate', 'snow', 'solar',
  'spark', 'spruce', 'star', 'stone', 'storm', 'stream', 'summit', 'swan',
  'teal', 'thorn', 'thunder', 'tiger', 'topaz', 'trail', 'tulip', 'tundra',
  'valley', 'velvet', 'vine', 'violet', 'wave', 'west', 'wheat', 'willow',
  'wind', 'wolf', 'wren', 'zinc', 'alder', 'basin', 'cliffside', 'drift',
  'fjord', 'gorge', 'heath', 'inlet', 'kelp', 'moor', 'peak', 'quarry',
  'reed', 'shoal', 'thicket', 'vale', 'wharf', 'yarrow'
] as const

const pick = (max: number): number => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return (buf[0] as number) % max
}

export function randomRoomName(): string {
  const pool = [...WORDS]
  const chosen: string[] = []
  for (let i = 0; i < 3; i += 1) {
    chosen.push(pool.splice(pick(pool.length), 1)[0] as string)
  }
  return chosen.join('-')
}
