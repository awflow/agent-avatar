/*
 * <awf-avatar> and <awf-avatar-group>. Light DOM: the core's mount() owns
 * the element's children, one svg. Attributes are options; an attribute
 * change goes to handle.set(), which the core splits into a state change
 * (the svg stays) and an identity change (a new svg). Disconnecting destroys
 * the handle; connecting again mounts afresh, so moving the element in the
 * DOM never leaks a rig or leaves two svgs.
 *
 * The classes are built by a factory so that nothing touches HTMLElement
 * when the module is imported in Node.
 */
import { LATEST } from '@awflow/avatar'
import {
  type AvatarHandle,
  type MountOptions,
  mount,
} from '@awflow/avatar/adapter'
import { createGroup, type Group } from './group'
import { ATTRIBUTES, parseAttribute } from './parse'

const HANDLE = Symbol.for('awflow.avatar.element.handle')
const JOIN = Symbol.for('awflow.avatar.element.join')
const LEAVE = Symbol.for('awflow.avatar.element.leave')
const GROUP = Symbol.for('awflow.avatar.element.group')
const NOTIFY = Symbol.for('awflow.avatar.element.notify')
const AIM = Symbol.for('awflow.avatar.element.aim')

// every element gets its own svg ids: two identical avatars on one page
// never share a clip path or gradient
let serial = 0

/* the svg id prefix for element number `n`: `peek-` at version 1, `awf-`
 * from version 2, as the core's generated ids */
function domId(n: number, version: unknown): string {
  const v = typeof version === 'number' ? version : LATEST
  return `${v >= 2 ? 'awf' : 'peek'}-e${n}`
}

/* an avatar element whose gaze follows another's handle */
type Watcher = { [AIM](): void }

/* a property set before the element was defined shadows its accessor */
function upgradeProperties(el: object, keys: string[]): void {
  for (const k of keys) {
    if (!Object.hasOwn(el, k)) continue
    const v = (el as Record<string, unknown>)[k]
    delete (el as Record<string, unknown>)[k]
    ;(el as Record<string, unknown>)[k] = v
  }
}

type Joinable = {
  [HANDLE]: AvatarHandle | null
  [JOIN](): void
  [LEAVE](): void
  [NOTIFY]: Set<Watcher>
}
type GroupHost = {
  [GROUP]: Group
}

const isAvatar = (x: unknown): x is Joinable =>
  typeof x === 'object' && x !== null && HANDLE in x
const isGroup = (x: unknown): x is GroupHost =>
  typeof x === 'object' && x !== null && GROUP in x

/** The public face of <awf-avatar>. */
export interface AwfAvatarElement extends HTMLElement {
  /** The core handle while connected with a name, otherwise null. */
  readonly handle: AvatarHandle | null
  react(name: NonNullable<MountOptions['reaction']>): void
  pulse(strength?: number): void
  setVoice(source: (() => number) | null): void
  /** Another avatar element, an element, a handle, or null to look ahead. */
  lookAt(target: AwfAvatarElement | AvatarHandle | Element | null): void
  /** Property forms for objects, same meaning as the attributes. */
  ring: MountOptions['ring']
  gaze: MountOptions['gaze']
  reaction: MountOptions['reaction']
  reactKey: unknown
}

/** The public face of <awf-avatar-group>. */
export interface AwfAvatarGroupElement extends HTMLElement {
  speaker: string | null
}

export function createElements(): {
  Avatar: new () => AwfAvatarElement
  Group: new () => AwfAvatarGroupElement
} {
  class Avatar extends HTMLElement {
    static get observedAttributes(): string[] {
      return Object.keys(ATTRIBUTES)
    }

    private opts: Record<string, unknown> = {}
    private mounted: AvatarHandle | null = null
    private leaveGroup: (() => void) | null = null
    private lookTarget: AwfAvatarElement | AvatarHandle | Element | null = null
    private rendered = false
    private readonly serial = ++serial
    readonly [NOTIFY] = new Set<Watcher>()

    constructor() {
      super()
      upgradeProperties(this, ['ring', 'gaze', 'reaction', 'reactKey'])
    }

    /* points the gaze at the current target, its handle resolved now */
    [AIM](): void {
      const t = this.lookTarget
      this.mounted?.lookAt(
        (isAvatar(t) ? t[HANDLE] : t) as AvatarHandle | Element | null,
      )
    }

    private changed(): void {
      for (const w of this[NOTIFY]) w[AIM]()
    }

    get handle(): AvatarHandle | null {
      return this.mounted
    }

    get [HANDLE](): AvatarHandle | null {
      return this.mounted
    }

    connectedCallback(): void {
      // some upgrade paths skip attributeChangedCallback for existing attributes
      for (const attr of Object.keys(ATTRIBUTES)) {
        const p = this.hasAttribute(attr)
          ? parseAttribute(attr, this.getAttribute(attr))
          : undefined
        if (p && !(p.key in this.opts)) this.opts[p.key] = p.value
      }
      // follow the gaze target again, dropped on disconnect
      if (isAvatar(this.lookTarget)) this.lookTarget[NOTIFY].add(this)
      this.mountNow()
    }

    disconnectedCallback(): void {
      // a detached element must not be kept alive by its gaze target
      if (isAvatar(this.lookTarget)) this.lookTarget[NOTIFY].delete(this)
      this[LEAVE]()
      this.mounted?.destroy()
      this.mounted = null
      this.changed()
    }

    attributeChangedCallback(
      attr: string,
      _old: string | null,
      value: string | null,
    ): void {
      const p = parseAttribute(attr, value)
      if (!p) return
      this.apply({ [p.key]: p.value })
    }

    private apply(input: Record<string, unknown>): void {
      Object.assign(this.opts, input)
      if (!this.isConnected) return
      // a new version may change the id prefix
      const patch =
        'version' in input
          ? { ...input, id: domId(this.serial, this.opts.version) }
          : input
      if (patch.name !== undefined || this.opts.name === undefined) {
        // the name is the avatar's identity and its group key
        if (patch.name === undefined) {
          this.unmount()
          return
        }
        if (this.mounted) {
          this.mounted.set(patch as Partial<MountOptions>)
          this[LEAVE]()
          this[JOIN]()
          return
        }
        this.mountNow()
        return
      }
      this.mounted?.set(patch as Partial<MountOptions>)
    }

    private mountNow(): void {
      this.mounted?.destroy()
      this.mounted = null
      if (typeof this.opts.name !== 'string') {
        this.unmount()
        return
      }
      this.mounted = mount(this, {
        ...this.opts,
        id: domId(this.serial, this.opts.version),
      } as MountOptions)
      this.rendered = true
      this[AIM]()
      this[JOIN]()
      this.changed()
    }

    private unmount(): void {
      this[LEAVE]()
      this.mounted?.destroy()
      this.mounted = null
      // only our own svg is cleared, never the user's fallback content
      if (this.rendered) this.replaceChildren()
      this.rendered = false
      this.changed()
    }

    [JOIN](): void {
      this[LEAVE]()
      const handle = this.mounted
      if (!handle) return
      for (let p = this.parentElement; p; p = p.parentElement) {
        if (isGroup(p)) {
          const off = p[GROUP].registerMember(
            String(this.opts.name ?? ''),
            handle,
          )
          this.leaveGroup = off
          return
        }
      }
    }

    [LEAVE](): void {
      if (!this.leaveGroup) return
      this.leaveGroup()
      this.leaveGroup = null
      this[AIM]()
    }

    react(name: NonNullable<MountOptions['reaction']>): void {
      this.mounted?.react(name)
    }

    pulse(strength?: number): void {
      this.mounted?.pulse(strength)
    }

    setVoice(source: (() => number) | null): void {
      this.mounted?.setVoice(source)
    }

    lookAt(target: AwfAvatarElement | AvatarHandle | Element | null): void {
      if (isAvatar(this.lookTarget)) this.lookTarget[NOTIFY].delete(this)
      this.lookTarget = target
      // follow the target's handle as it mounts, moves and remounts; a
      // detached element starts following when it connects
      if (isAvatar(target) && this.isConnected) target[NOTIFY].add(this)
      this[AIM]()
    }

    get ring(): MountOptions['ring'] {
      return this.opts.ring as MountOptions['ring']
    }
    set ring(v: MountOptions['ring']) {
      this.apply({ ring: v ?? undefined })
    }
    get gaze(): MountOptions['gaze'] {
      return this.opts.gaze as MountOptions['gaze']
    }
    set gaze(v: MountOptions['gaze']) {
      this.apply({ gaze: v ?? undefined })
    }
    get reaction(): MountOptions['reaction'] {
      return this.opts.reaction as MountOptions['reaction']
    }
    set reaction(v: MountOptions['reaction']) {
      this.apply({ reaction: v ?? undefined })
    }
    get reactKey(): unknown {
      return this.opts.reactKey
    }
    set reactKey(v: unknown) {
      this.apply({ reactKey: v })
    }
  }

  class AvatarGroup extends HTMLElement {
    static get observedAttributes(): string[] {
      return ['speaker']
    }

    readonly [GROUP]: Group = createGroup()

    constructor() {
      super()
      upgradeProperties(this, ['speaker'])
    }

    get speaker(): string | null {
      return this.getAttribute('speaker')
    }
    set speaker(v: string | null) {
      if (v === null) this.removeAttribute('speaker')
      else this.setAttribute('speaker', v)
    }

    attributeChangedCallback(
      _attr: string,
      _old: string | null,
      value: string | null,
    ): void {
      this[GROUP].setSpeaker(value ?? undefined)
    }

    connectedCallback(): void {
      // members that connected before this element was upgraded
      for (const el of Array.from(this.querySelectorAll('*')))
        if (isAvatar(el)) el[JOIN]()
    }

    disconnectedCallback(): void {
      for (const el of Array.from(this.querySelectorAll('*')))
        if (isAvatar(el)) el[LEAVE]()
    }
  }

  return {
    Avatar: Avatar as unknown as new () => AwfAvatarElement,
    Group: AvatarGroup as unknown as new () => AwfAvatarGroupElement,
  }
}
