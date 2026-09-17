import {h, icon} from './dom'
import {browserLook, deviceTag, osLook, type Device} from './devices'
import {fileMeta, isFile, isText, type Entry} from './entries'
import {clock, devicesWord, entriesWord, linesWord, bytes, speed} from './format'

export type Status = 'waiting' | 'work' | 'down'

export type ViewState = {
  room: string
  draft: string
  entries: Entry[]
  me: Device
  peers: Device[]
  status: Status
  copiedId: string | null
  expanded: Set<string>
  dragging: boolean
}

export type Actions = {
  onRoomInput: (value: string) => void
  onDraft: (value: string) => void
  onSend: () => void
  onFiles: (files: File[]) => void
  onDragging: (active: boolean) => void
  onPrimary: (entry: Entry) => void
  onResend: (entry: Entry) => void
  onDelete: (id: string) => void
  onToggleExpand: (id: string) => void
  onReconnect: () => void
}

type EntryNode = {el: HTMLElement; update: (entry: Entry, state: ViewState) => void}

const COLLAPSE_AFTER = 5

export function createUI(actions: Actions): {root: HTMLElement; render: (state: ViewState) => void} {
  const roomInput = h('input', {
    class: 'room-input',
    type: 'text',
    autocomplete: 'off',
    placeholder: 'имя-комнаты',
    oninput: (event: Event) => actions.onRoomInput((event.target as HTMLInputElement).value)
  })
  roomInput.spellcheck = false

  const linkIcon = icon('fa-solid fa-link')
  const linkText = h('span', {})
  const linkState = h('div', {class: 'link-state'}, linkIcon, linkText)
  const deviceList = h('div', {class: 'header__side'}, linkState)

  const header = h('div', {class: 'header'},
    h('div', {class: 'header__room'},
      h('span', {class: 'kicker'}, 'Имя комнаты — оно же пароль · любые символы'),
      h('div', {class: 'room-row'}, roomInput)),
    deviceList)

  const banner = h('div', {class: 'banner'},
    icon('fa-solid fa-triangle-exclamation'),
    h('div', {style: 'min-width:0'},
      h('div', {class: 'banner__title'}, 'Соединение с комнатой потеряно'),
      h('div', {class: 'banner__text'},
        'Прямой канал между браузерами закрылся. Записи ниже — локальная копия: копировать можно, отправлять нельзя.'),
      h('div', {class: 'banner__hint'},
        'Проверьте сеть на обоих устройствах. Если второе устройство перезагружало браузер — откройте ссылку и наберите имя комнаты снова.'),
      h('div', {class: 'banner__acts'},
        h('button', {type: 'button', class: 'banner__retry', onclick: actions.onReconnect},
          icon('fa-solid fa-rotate-right'), 'Переподключиться'))))

  const textarea = h('textarea', {
    class: 'composer__area',
    placeholder: 'Вставьте текст (Ctrl+V), наберите вручную или перетащите файл сюда',
    oninput: (event: Event) => actions.onDraft((event.target as HTMLTextAreaElement).value)
  })
  const draftCount = h('span', {class: 'composer__count'})
  const sendButton = h('button', {type: 'button', class: 'composer__send', onclick: actions.onSend},
    icon('fa-solid fa-paper-plane'), 'Отправить')

  // Перетаскивания на телефоне нет, поэтому файл выбирается обычным
  // системным диалогом: на мобильных он же предлагает камеру и галерею.
  const filePicker = h('input', {type: 'file', multiple: true, class: 'composer__picker'})
  filePicker.addEventListener('change', () => {
    const files = [...(filePicker.files ?? [])]
    // Сбрасываем значение, иначе повторный выбор того же файла не даст события.
    filePicker.value = ''
    if (files.length) actions.onFiles(files)
  })
  const attachButton = h('button', {
    type: 'button', class: 'mini composer__attach', onclick: () => filePicker.click()
  }, icon('fa-solid fa-paperclip'), 'Прикрепить файл')

  const composer = h('div', {class: 'composer'},
    textarea,
    h('div', {class: 'composer__foot'},
      attachButton,
      filePicker,
      h('span', {class: 'composer__hint'}, 'или перетащите в поле'),
      draftCount,
      sendButton))

  composer.addEventListener('dragover', event => {
    event.preventDefault()
    actions.onDragging(true)
  })
  composer.addEventListener('dragleave', event => {
    if (!composer.contains(event.relatedTarget as Node | null)) actions.onDragging(false)
  })
  composer.addEventListener('drop', event => {
    event.preventDefault()
    actions.onDragging(false)
    const files = [...(event as DragEvent).dataTransfer?.files ?? []]
    if (files.length) actions.onFiles(files)
  })

  const onboardUrl = h('div', {class: 'onboard__url'})
  const onboard = h('div', {class: 'onboard'},
    h('div', {class: 'onboard__title'}, 'Пока подключено только это устройство'),
    h('div', {class: 'onboard__lead'},
      'Всё, что вы отправите, дойдёт до второго устройства сразу после его подключения. Чтобы подключить его:'),
    h('div', {class: 'onboard__steps'},
      step('1', 'Откройте на нём тот же адрес', onboardUrl,
        'Если буфер обмена на этом устройстве работает — можно скопировать ссылку целиком, вместе с частью после решётки: имя комнаты уже в ней.'),
      step('2', 'Наберите имя комнаты руками', null,
        'Ровно как в поле вверху этой страницы. Имя может быть любым — три слова через дефис просто удобнее переписывать глазами. Имя — одновременно пароль: кто его наберёт, тот и в комнате; само имя никуда не отправляется, релей видит только его хеш.'),
      step('3', 'Работайте', null,
        'Записи появляются на обоих экранах мгновенно и никуда не сохраняются: сервера нет, канал прямой.')))

  const feedCount = h('span', {class: 'feed-head__count'})
  const feed = h('div', {class: 'feed'})

  const shell = h('div', {class: 'shell'},
    header, banner, composer, onboard,
    h('div', {class: 'feed-head'}, h('span', {class: 'kicker'}, 'Лента — новые сверху'), feedCount),
    feed)

  const root = h('div', {class: 'app', data: {dens: 'normal'}}, shell)

  const nodes = new Map<string, EntryNode>()

  const render = (state: ViewState): void => {
    if (document.activeElement !== roomInput && roomInput.value !== state.room) roomInput.value = state.room

    const down = state.status === 'down'
    const total = state.peers.length + 1
    linkIcon.className = down ? 'fa-solid fa-link-slash' : 'fa-solid fa-link'
    linkState.dataset['down'] = String(down)
    linkText.textContent = down
      ? 'связь потеряна, ждём второе устройство'
      : `подключено ${total} ${devicesWord(total)}`

    deviceList.replaceChildren(linkState, deviceRow(state.me, true),
      ...state.peers.map(peer => deviceRow(peer, false)))

    banner.style.display = down ? '' : 'none'
    onboard.style.display = state.status === 'waiting' ? '' : 'none'
    onboardUrl.textContent = location.origin + location.pathname

    if (textarea.value !== state.draft) textarea.value = state.draft
    draftCount.textContent = state.draft ? `${state.draft.length} симв.` : ''
    ;(sendButton as HTMLButtonElement).disabled = down || !state.draft.trim()
    ;(attachButton as HTMLButtonElement).disabled = down
    composer.dataset['drag'] = String(state.dragging)

    feedCount.textContent = state.entries.length
      ? `${state.entries.length} ${entriesWord(state.entries.length)}`
      : 'пусто'

    const seen = new Set<string>()
    for (const entry of state.entries) {
      seen.add(entry.id)
      let node = nodes.get(entry.id)
      if (!node) {
        node = createEntryNode(actions)
        nodes.set(entry.id, node)
      }
      node.update(entry, state)
    }
    for (const [id, node] of nodes) {
      if (!seen.has(id)) {
        node.el.remove()
        nodes.delete(id)
      }
    }
    // Порядок задаётся лентой: переотправка поднимает запись наверх.
    feed.replaceChildren(...state.entries.map(entry => (nodes.get(entry.id) as EntryNode).el))
  }

  return {root, render}
}

function step(num: string, head: string, extra: HTMLElement | null, note: string): HTMLElement {
  return h('div', {class: 'onboard__step'},
    h('span', {class: 'onboard__num'}, num),
    h('div', {},
      h('div', {class: 'onboard__head'}, head),
      extra,
      h('div', {class: 'onboard__note'}, note)))
}

function deviceRow(device: Device, mine: boolean): HTMLElement {
  const tag = deviceTag(device)
  return h('div', {class: 'device', title: mine ? `${tag} — это вы` : tag},
    icon(osLook(device).icon),
    icon(browserLook(device).icon),
    h('span', {class: 'device__tag'}, tag),
    mine ? h('span', {class: 'device__mark'}, 'это вы') : null)
}

function createEntryNode(actions: Actions): EntryNode {
  const time = h('span', {class: 'entry__time'})
  const whoOs = icon('')
  const whoBrowser = icon('')
  const whoName = h('span', {})
  const who = h('span', {class: 'entry__who'}, whoOs, whoBrowser, whoName)
  const kind = h('span', {class: 'entry__kind'})
  const del = h('button', {type: 'button', class: 'entry__del'}, 'Удалить')
  const meta = h('div', {class: 'entry__meta'}, time, who, kind, del)

  const body = h('div', {class: 'entry__body'})
  const expand = h('button', {type: 'button', class: 'mini entry__expand'})

  const fileName = h('div', {class: 'entry__filename'})
  const fileInfo = h('div', {class: 'entry__filemeta'})
  const fileBox = h('div', {class: 'entry__file'},
    icon('fa-solid fa-file-zipper'),
    h('div', {style: 'min-width:0;flex:1'}, fileName, fileInfo))

  const fill = h('div', {class: 'progress__fill'})
  const progressText = h('span', {})
  const speedText = h('span', {})
  const progress = h('div', {class: 'progress'},
    h('div', {class: 'progress__track'}, fill),
    h('div', {class: 'progress__text'}, progressText, speedText))

  const primaryIcon = icon('')
  const primaryLabel = h('span', {})
  const primary = h('button', {type: 'button', class: 'acts__primary'}, primaryIcon, primaryLabel)
  const resend = h('button', {
    type: 'button', class: 'mini acts__resend',
    title: 'Переотправить — поднять запись наверх и отправить заново'
  }, icon('fa-solid fa-paper-plane'), 'Ещё раз')

  const el = h('div', {class: 'row'},
    h('div', {class: 'entry'},
      h('div', {class: 'entry__main'}, meta, body, expand, fileBox, progress),
      h('div', {class: 'acts'}, primary, resend)))

  let current: Entry | null = null
  del.addEventListener('click', () => current && actions.onDelete(current.id))
  expand.addEventListener('click', () => current && actions.onToggleExpand(current.id))
  primary.addEventListener('click', () => current && actions.onPrimary(current))
  resend.addEventListener('click', () => current && actions.onResend(current))

  const update = (entry: Entry, state: ViewState): void => {
    current = entry
    el.dataset['mine'] = String(entry.mine)
    time.textContent = clock(entry.at)
    whoOs.className = osLook(entry.device).icon
    whoBrowser.className = browserLook(entry.device).icon
    whoName.textContent = entry.mine ? 'вы' : 'другая сессия'
    who.dataset['mine'] = String(entry.mine)
    // В ленте у записи только иконки, а iOS и macOS носят одну и ту же
    // яблочную — подпись остаётся в подсказке.
    who.title = deviceTag(entry.device)
    kind.textContent = entry.kind === 'file' ? 'файл' : 'текст'

    const text = isText(entry)
    const lines = text ? entry.body.split('\n').length : 0
    const long = lines > COLLAPSE_AFTER
    const open = state.expanded.has(entry.id)

    body.style.display = text ? '' : 'none'
    if (text) {
      body.textContent = entry.body
      body.dataset['collapsed'] = String(long && !open)
    }
    expand.style.display = text && long ? '' : 'none'
    expand.textContent = open ? 'Свернуть' : `Показать полностью (${lines} ${linesWord(lines)})`

    const file = isFile(entry)
    fileBox.style.display = file ? '' : 'none'
    const transferring = file && entry.progress !== null
    progress.style.display = transferring ? '' : 'none'

    if (file) {
      fileName.textContent = entry.name
      fileInfo.textContent = fileMeta(entry)
      if (entry.progress !== null) {
        const percent = Math.round(entry.progress * 100)
        fill.style.width = `${percent}%`
        progressText.textContent = `${percent}% · ${bytes(entry.size * entry.progress)} из ${bytes(entry.size)}`
        speedText.textContent = entry.speed === null ? '' : speed(entry.speed)
      }
    }

    const copied = state.copiedId === entry.id
    const noAction = transferring || (file && !entry.blob)
    primary.dataset['copied'] = String(copied)
    ;(primary as HTMLButtonElement).disabled = noAction
    primaryIcon.className = copied
      ? 'fa-solid fa-check'
      : file ? 'fa-solid fa-download' : 'fa-solid fa-copy'
    primaryLabel.textContent = noAction && !copied
      ? (transferring ? 'Передаётся' : 'Нет файла')
      : copied
        ? (file ? 'Сохраняется' : 'Скопировано')
        : (file ? 'Скачать' : 'Копировать')

    const canResend = entry.mine && !transferring && state.status === 'work' && (text || Boolean(file && entry.blob))
    resend.style.display = canResend ? '' : 'none'
  }

  return {el, update}
}
