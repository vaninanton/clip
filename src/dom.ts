type Child = Node | string | null | undefined | false

/**
 * Минимальная замена JSX: фреймворка нет, а собирать интерфейс
 * через createElement вручную — многословно.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue
    if (key === 'class') {
      el.className = String(value)
    } else if (key === 'data') {
      Object.assign(el.dataset, value as Record<string, string>)
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener)
    } else if (key in el) {
      Reflect.set(el, key, value)
    } else {
      el.setAttribute(key, String(value))
    }
  }

  append(el, children)
  return el
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child == null || child === false) continue
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
}

export const icon = (cls: string): HTMLElement => h('i', {class: cls})

export const clear = (el: Element): void => el.replaceChildren()
