/*
 * The live avatar: a Rig bound to an SVG that already shows its tree. One
 * module-level requestAnimationFrame loop steps every live avatar; each step
 * draws the tree for the rig's pose and writes only the attributes that
 * changed straight onto the DOM. React never hears about a frame.
 *
 * Everything that touches the page lives here: binding nodes, attribute
 * writes, visibility, the pointer, lookAt measurement in client px and the
 * reduced-motion query. The motion itself is the Rig's.
 */

import type { Activity } from './activity'
import {
  type Drawable,
  type DrawOptions,
  type Gaze,
  type Node,
  type Ring,
  VB,
} from './draw'
import type { Reaction } from './reactions'
import { MAX_DT, Rig } from './rig'
import type { Expression } from './tables'

/* ---------- the shared loop ---------- */

/* every bound avatar, and the ones the loop steps (not under reduced
 * motion) */
const ALL = new Set<Live>()
const LIVE = new Set<Live>()
let raf = 0
let last = 0

function tick(now: number) {
  const dt = Math.min(MAX_DT, (now - last) / 1000)
  last = now
  if (!document.hidden) {
    // every layout read before any write: one layout a frame, not one a face
    for (const l of LIVE) if (l.visible) l.measure()
    for (const l of LIVE) if (l.visible) l.step(dt)
  }
  raf = LIVE.size ? requestAnimationFrame(tick) : 0
}
function run() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

/** How many avatars are bound and how many the loop steps. For tests. */
export function liveCount(): { all: number; live: number } {
  return { all: ALL.size, live: LIVE.size }
}

/**
 * Throws unless `el` shows `node` element for element: the same tags and
 * the same number of children all the way down. `what` names the tree in the
 * message ('live' or 'static').
 */
export function correspond(
  node: Node,
  el: Element,
  what: string,
  here = node.tag,
) {
  const tag = el.localName || el.tagName
  if (
    tag.toLowerCase() !== node.tag.toLowerCase() ||
    el.children.length !== node.children.length
  )
    throw new Error(
      `@awflow/avatar: the <svg> does not match the ${what} tree at ${here}: expected <${node.tag}> with ${node.children.length} children, found <${tag}> with ${el.children.length}. ${
        what === 'live'
          ? 'An animated avatar must be server-rendered from the live tree (settle(name, opts, true) and draw), not toSvg, with the same options and plugins.'
          : 'Render it with toSvg and the same options and plugins.'
      }`,
    )
  node.children.forEach((c, i) => {
    correspond(c, el.children[i]!, what, `${here} > ${c.tag}[${i}]`)
  })
}

/* prefers-reduced-motion, watched once for every avatar */
let motionQuery: MediaQueryList | null = null
function reducedMotion() {
  if (!motionQuery) {
    motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
    motionQuery.addEventListener('change', (e) => {
      for (const l of ALL) l.setReduced(e.matches)
    })
  }
  return motionQuery.matches
}

/* what the pointer is doing, in client px; listened to once, by the first
 * avatar that watches it */
let pointer: [number, number] | null = null
let listening = false
function listen() {
  if (listening) return
  listening = true
  const at = (e: PointerEvent) => {
    pointer = [e.clientX, e.clientY]
  }
  document.addEventListener('pointermove', at, { passive: true })
  document.addEventListener('pointerdown', at, { passive: true })
  document.documentElement.addEventListener('pointerleave', () => {
    pointer = null
  })
}

/**
 * One live avatar bound to an SVG that already shows `tree`. Starts settled
 * in `expression` and `activity`, the same pose the server painted.
 */
export class Live {
  visible = true
  private reduced: boolean
  private rig: Rig
  private nodes = new Map<string, Element>()
  private prev = new Map<string, Record<string, string>>()
  private io: IntersectionObserver | null = null
  private watch = false
  private rect: DOMRect | null = null
  // who the eyes follow instead of the pointer, and where that is this frame
  private gazeTarget: Live | Element | null = null
  private aim: [number, number] | null = null

  constructor(
    private svg: SVGSVGElement,
    tree: Node,
    who: Drawable,
    opts: DrawOptions,
    expression: Expression,
    gaze?: Gaze | 'pointer',
    activity?: Activity,
  ) {
    this.reduced = reducedMotion()
    this.rig = new Rig(
      who,
      opts,
      {
        expression,
        activity: activity ?? 'idle',
        gaze: Array.isArray(gaze) ? (gaze as Gaze) : undefined,
        reduced: this.reduced,
      },
      Math.random,
    )
    // a mismatched DOM throws here, before anything is registered
    correspond(tree, svg, 'live')
    this.bind(tree, svg)
    this.watch = gaze === 'pointer'
    if (this.watch) listen()
    // the DOM may hold a pose other than this one: the first paint fixes it
    this.paint()
    this.io = new IntersectionObserver((es) => {
      for (const e of es) this.visible = e.isIntersecting
    })
    this.io.observe(svg)
    ALL.add(this)
    if (this.reduced) return
    LIVE.add(this)
    run()
  }

  destroy() {
    ALL.delete(this)
    LIVE.delete(this)
    this.io?.disconnect()
  }

  /** Reduced motion turned on or off while the page is open. */
  setReduced(reduced: boolean) {
    if (reduced === this.reduced) return
    this.reduced = reduced
    this.rig.setReduced(reduced)
    if (!reduced) {
      LIVE.add(this)
      run()
      return
    }
    LIVE.delete(this)
    this.paint()
  }

  /** Read before any face writes this frame; see tick(). */
  measure() {
    const t = this.gazeTarget
    if (t && (t instanceof Live ? !ALL.has(t) : !t.isConnected))
      this.gazeTarget = null
    this.aim = this.gazeTarget ? this.targetPoint(this.gazeTarget) : null
    this.rect =
      this.aim || (this.watch && pointer)
        ? this.svg.getBoundingClientRect()
        : null
  }

  /** The svg this avatar draws into, for others to measure. */
  get element(): SVGSVGElement {
    return this.svg
  }

  /** Look at another avatar or element; null goes back to the own gaze. */
  lookAt(target: Live | Element | null) {
    this.gazeTarget = target === this ? null : target
    if (!this.gazeTarget) this.aim = null
  }

  /** A target's eye centre (an element's centre) in client px. */
  private targetPoint(t: Live | Element): [number, number] | null {
    if (t instanceof Live) {
      const r = t.svg.getBoundingClientRect()
      if (!(r.width > 0)) return null
      const [ex, ey] = t.rig.eye()
      return [
        r.left + ((ex - VB[0]) / VB[2]) * r.width,
        r.top + ((ey - VB[1]) / VB[3]) * r.height,
      ]
    }
    const r = t.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  }

  /**
   * Pairs every node in the tree with the element rendered for it (checked
   * by correspond() first), and remembers what that element shows now,
   * which is not always `node`.
   */
  private bind(node: Node, el: Element) {
    this.nodes.set(node.key, el)
    const now: Record<string, string> = {}
    for (const a of Array.from(el.attributes))
      if (a.name !== 'class' && a.name !== 'style') now[a.name] = a.value
    this.prev.set(node.key, now)
    node.children.forEach((c, i) => {
      this.bind(c, el.children[i]!)
    })
  }

  private write(node: Node) {
    const el = this.nodes.get(node.key)
    const prev = this.prev.get(node.key) ?? {}
    if (el) {
      for (const k in node.attrs)
        if (prev[k] !== node.attrs[k]) el.setAttribute(k, node.attrs[k]!)
      for (const k in prev) if (!(k in node.attrs)) el.removeAttribute(k)
    }
    this.prev.set(node.key, node.attrs)
    for (const c of node.children) this.write(c)
  }

  setGaze(gaze?: Gaze | 'pointer') {
    this.watch = gaze === 'pointer'
    if (this.watch) listen()
    this.rig.setGaze(Array.isArray(gaze) ? (gaze as Gaze) : null)
    if (this.reduced) this.paint()
  }

  /**
   * What the agent is doing. Springs retarget straight to the blended pose,
   * no choreography, so calling this every frame stays cheap; the activity's
   * loop rides on top. Under reduced motion the static pose applies at once.
   */
  setActivity(activity: Activity) {
    this.rig.setActivity(activity)
    if (this.reduced) this.paint()
  }

  /**
   * The presence ring is state: it changes here, on the node the live tree
   * always carries, never through a new tree.
   */
  setRing(ring: Ring | null) {
    this.rig.setRing(ring)
    this.paint()
  }

  /* each group starts on its own beat */
  setExpression(name: Expression) {
    this.rig.setExpression(name)
    if (this.reduced) this.paint()
  }

  /**
   * A one-shot gesture on top of whatever the face is doing; a new one
   * replaces the running one. Unknown names and reduced motion do nothing.
   */
  react(name: Reaction) {
    this.rig.react(name)
  }

  /**
   * A live mouth level, 0..1, read once a frame while the avatar speaks. It
   * replaces the built-in flap. NaN, infinities and out of range values are
   * treated as 0 or clamped. `null` takes the source away.
   */
  setVoice(source: (() => number) | null) {
    this.rig.setVoice(source)
  }

  /**
   * One token or chunk of speech: opens the mouth by `strength` (0..1,
   * default 1) and lets it close over 120 ms. It does nothing unless the
   * avatar is speaking, or under reduced motion, which freezes the loops the
   * mouth rides on.
   */
  pulse(strength = 1) {
    this.rig.pulse(strength)
  }

  step(elapsed: number) {
    // the pointer or the lookAt target, mapped from client px into the frame
    const at = this.aim ?? pointer
    const r = this.rect
    const aim: [number, number] | null =
      at && r && r.width > 0
        ? [
            VB[0] + ((at[0] - r.left) / r.width) * VB[2],
            VB[1] + ((at[1] - r.top) / r.height) * VB[3],
          ]
        : null
    this.rig.step(elapsed, { aim })
    this.paint()
  }

  private paint() {
    this.write(this.rig.tree())
  }
}
