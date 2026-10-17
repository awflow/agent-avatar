/*
 * mount(): the framework-free live avatar. It renders an avatar into an
 * element (or adopts one the server rendered, through attach()) and hands
 * back a small imperative handle that every framework adapter wraps.
 *
 * Two kinds of change reach it through set():
 * - identity: anything that changes what the face is (name, axes, size,
 *   theme, version, animate...). The svg is rebuilt and, when animated, a
 *   fresh Live replaces the old one.
 * - state: expression, activity, gaze and ring. Animated, they go straight
 *   to the Live and the svg element stays the same; static, the same svg is
 *   redrawn in place.
 *
 * An animated avatar renders the live tree (settle(name, opts, true) and
 * draw); a static one renders toSvg's tree. attach() checks the DOM it adopts
 * against that tree, element for element, and throws on a mismatch.
 */

import { correspond, Live } from './animate'
import {
  type Drawable,
  type DrawOptions,
  draw,
  type Gaze,
  type Node,
} from './draw'
import type { Reaction } from './reactions'
import { type AvatarOptions, settle } from './svg'

export type MountOptions = Omit<AvatarOptions, 'gaze'> & {
  name: string
  /** x and y in -1..1, or 'pointer' to follow the pointer (animate only). */
  gaze?: Gaze | 'pointer'
  /** Bring it to life. Off under prefers-reduced-motion. */
  animate?: boolean
  /**
   * A reaction to play each time `reactKey` changes after mount (never on
   * mount itself). Animated avatars only.
   */
  reaction?: Reaction
  reactKey?: unknown
}

export type AvatarHandle = {
  /** The svg showing the avatar; a new element after an identity change. */
  readonly element: SVGSVGElement
  /** Changes options; see the file comment for what rebuilds and what not. */
  set(patch: Partial<MountOptions>): void
  react(name: Reaction): void
  pulse(strength?: number): void
  setVoice(source: (() => number) | null): void
  lookAt(target: AvatarHandle | Element | null): void
  /** Stops the motion. The svg stays where it is, showing its last frame. */
  destroy(): void
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/* what settle() draws from: the gaze it understands, nothing adapter-only */
function split(o: MountOptions) {
  const {
    name,
    animate,
    reaction: _reaction,
    reactKey: _reactKey,
    gaze,
    ...rest
  } = o
  const look: AvatarOptions = {
    ...rest,
    gaze: Array.isArray(gaze) ? (gaze as Gaze) : undefined,
  }
  return { name, animate: animate === true, look }
}

/* everything that decides the svg's shape, state left out */
function identityKey(o: MountOptions): string {
  const { name, animate, look } = split(o)
  const {
    expression: _expression,
    activity: _activity,
    gaze: _gaze,
    ring: _ring,
    ...id
  } = look
  const { who, opts } = settle(name, id, animate)
  return JSON.stringify([who, opts])
}

/**
 * True when going from `prev` to `next` changes what the face is, so the
 * svg must be rebuilt. Expression, activity, gaze, ring, reaction and
 * reactKey are state and never count.
 */
export function isIdentityChange(
  prev: MountOptions,
  next: MountOptions,
): boolean {
  return identityKey(prev) !== identityKey(next)
}

type Built = {
  tree: Node
  who: Drawable
  opts: DrawOptions
  animate: boolean
}

function build(o: MountOptions): Built {
  const { name, animate, look } = split(o)
  const { who, pose, opts } = settle(name, look, animate)
  return { tree: draw(who, pose, opts), who, opts, animate }
}

function create(doc: Document, node: Node): Element {
  const el = doc.createElementNS(SVG_NS, node.tag)
  for (const k in node.attrs) el.setAttribute(k, node.attrs[k]!)
  for (const c of node.children) el.appendChild(create(doc, c))
  return el
}

/* the root's own attributes, kept apart from class and style a host set */
function syncRoot(svg: Element, attrs: Record<string, string>) {
  for (const a of Array.from(svg.attributes))
    if (a.name !== 'class' && a.name !== 'style' && !(a.name in attrs))
      svg.removeAttribute(a.name)
  for (const k in attrs)
    if (svg.getAttribute(k) !== attrs[k]) svg.setAttribute(k, attrs[k]!)
}

const ringKey = (o: MountOptions) => JSON.stringify(o.ring ?? null)

/* the keys that are state: a patch of only these never changes identity */
const STATE = new Set<string>([
  'expression',
  'activity',
  'gaze',
  'ring',
  'reaction',
  'reactKey',
])
const stateOnly = (patch: object) =>
  Object.keys(patch).every((k) => STATE.has(k))

class Mounted implements AvatarHandle {
  private o: MountOptions
  private key: string
  private live: Live | null = null
  private dead = false
  private gazeAt: AvatarHandle | Element | null = null
  private voice: (() => number) | null = null
  // the handles looking at this one, re-aimed when it rebuilds
  private watchers = new Set<Mounted>()

  constructor(
    private svg: SVGSVGElement,
    o: MountOptions,
    built: Built,
  ) {
    this.o = { ...o }
    this.key = identityKey(this.o)
    this.start(built)
  }

  get element(): SVGSVGElement {
    return this.svg
  }

  private start(b: Built) {
    if (!b.animate) return
    const o = this.o
    this.live = new Live(
      this.svg,
      b.tree,
      b.who,
      b.opts,
      o.expression ?? 'normal',
      o.gaze,
      o.activity,
    )
    if (this.voice) this.live.setVoice(this.voice)
    this.aim()
    for (const w of this.watchers) w.aim()
  }

  set(patch: Partial<MountOptions>) {
    if (this.dead) return
    const prev = this.o
    const next = { ...prev, ...patch }
    this.o = next
    const key = stateOnly(patch) ? this.key : identityKey(next)
    if (key !== this.key) {
      this.key = key
      this.rebuild()
    } else if (this.live) {
      const l = this.live
      if (next.expression !== prev.expression)
        l.setExpression(next.expression ?? 'normal')
      if (next.activity !== prev.activity)
        l.setActivity(next.activity ?? 'idle')
      if (String(next.gaze) !== String(prev.gaze)) l.setGaze(next.gaze)
      if (ringKey(next) !== ringKey(prev)) l.setRing(next.ring ?? null)
    } else if (
      next.expression !== prev.expression ||
      next.activity !== prev.activity ||
      String(next.gaze) !== String(prev.gaze) ||
      ringKey(next) !== ringKey(prev)
    ) {
      // static: the same svg, redrawn
      const { tree } = build(next)
      const doc = this.svg.ownerDocument
      syncRoot(this.svg, tree.attrs)
      this.svg.replaceChildren(...tree.children.map((c) => create(doc, c)))
    }
    if (next.reaction && !Object.is(next.reactKey, prev.reactKey))
      this.live?.react(next.reaction)
  }

  private rebuild() {
    this.live?.destroy()
    this.live = null
    const b = build(this.o)
    const old = this.svg
    const svg = create(old.ownerDocument, b.tree) as SVGSVGElement
    // what a host put on the element survives the rebuild
    for (const a of ['class', 'style']) {
      const v = old.getAttribute(a)
      if (v !== null) svg.setAttribute(a, v)
    }
    old.replaceWith(svg)
    this.svg = svg
    this.start(b)
  }

  react(name: Reaction) {
    if (!this.dead) this.live?.react(name)
  }

  pulse(strength?: number) {
    if (!this.dead) this.live?.pulse(strength)
  }

  setVoice(source: (() => number) | null) {
    if (this.dead) return
    this.voice = source
    this.live?.setVoice(source)
  }

  lookAt(target: AvatarHandle | Element | null) {
    if (this.dead) return
    if (this.gazeAt instanceof Mounted) this.gazeAt.watchers.delete(this)
    this.gazeAt = target === this ? null : target
    if (this.gazeAt instanceof Mounted) this.gazeAt.watchers.add(this)
    this.aim()
  }

  /* hands the Live what it should look at now: another avatar's Live if it
   * has one, else an element */
  private aim() {
    const t = this.gazeAt
    this.live?.lookAt(
      t instanceof Mounted
        ? (t.live ?? t.svg)
        : t && !(t instanceof Element)
          ? t.element
          : t,
    )
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    this.live?.destroy()
    this.live = null
    if (this.gazeAt instanceof Mounted) this.gazeAt.watchers.delete(this)
    this.gazeAt = null
    for (const w of this.watchers) {
      w.gazeAt = null
      w.aim()
    }
    this.watchers.clear()
  }
}

/**
 * Renders the avatar into `target`, replacing its children, and returns its
 * handle. Animated, it renders the live tree and starts the shared loop;
 * otherwise toSvg's tree.
 */
export function mount(target: Element, opts: MountOptions): AvatarHandle {
  const b = build(opts)
  const svg = create(target.ownerDocument, b.tree) as SVGSVGElement
  target.replaceChildren(svg)
  return new Mounted(svg, opts, b)
}

/**
 * Adopts an svg the server rendered with the same options (the live tree
 * when animated, toSvg otherwise) without creating a new element. Throws a
 * descriptive error when the svg does not match that tree.
 */
export function attach(svg: SVGSVGElement, opts: MountOptions): AvatarHandle {
  const b = build(opts)
  // an animated Live checks the tree itself, before it registers
  if (!b.animate) correspond(b.tree, svg, 'static')
  return new Mounted(svg, opts, b)
}
