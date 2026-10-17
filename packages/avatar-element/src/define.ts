import { createElements } from './element'

/**
 * Registers `<prefix>-avatar` and `<prefix>-avatar-group` (default `awf`).
 * Skips a tag that is already defined, and does nothing where there is no
 * custom element registry (Node, SSR).
 */
export function defineAvatarElements(prefix = 'awf'): void {
  if (
    typeof customElements === 'undefined' ||
    typeof HTMLElement === 'undefined'
  )
    return
  const avatar = `${prefix}-avatar`
  const group = `${prefix}-avatar-group`
  if (customElements.get(avatar) && customElements.get(group)) return
  const { Avatar, Group } = createElements()
  if (!customElements.get(avatar)) customElements.define(avatar, Avatar)
  if (!customElements.get(group)) customElements.define(group, Group)
}
