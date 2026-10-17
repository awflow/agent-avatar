/*
 * The rig: springs, choreography, blinks, saccades and breathing, transcribed
 * from the v1.2 page. One module-level requestAnimationFrame loop steps every
 * live avatar; each step draws the tree for the current pose and writes only
 * the attributes that changed straight onto the DOM. React never hears about
 * a frame.
 *
 * Randomness lives here and only here: a face may be random in what it does,
 * never in what it is.
 */

import {
  ACTIVITIES,
  type Activity,
  activityLoop,
  activityOf,
  blend,
  type FxKind,
} from './activity'
import {
  clamp,
  type Drawable,
  type DrawOptions,
  draw,
  frameOf,
  type Gaze,
  loopPhase,
  type Node,
  type Pose,
  REST_T,
  type Ring,
  restPose,
  smooth,
  thingGaze,
  VB,
} from './draw'
import { type Swing, stepSwing } from './physics'
import { REACTIONS, type Reaction, reactionOf } from './reactions'
import {
  type Channel,
  type Channels,
  type Expression,
  FACES,
  GROUPS,
  type Group,
} from './tables'

type Spring = [omega: number, zeta: number]
type KeyValue = number | ((v: number) => number)
type Key = [
  at: number,
  set: Partial<Record<Channel | 'look', KeyValue>>,
  spr?: Partial<Record<Group, Spring>>,
]
type Choreo = {
  delay?: Partial<Record<Group, number>>
  spr?: Partial<Record<Group, Spring>>
  keys?: Key[]
}

const GROUP_OF = {} as Record<Channel, Group>
for (const gr of Object.keys(GROUPS) as Group[])
  for (const c of GROUPS[gr]) GROUP_OF[c] = gr
const CHANNELS = Object.keys(GROUP_OF) as Channel[]

/* choreography: when each group starts moving, how springy it is, and timed
 * keys */
const DEF_DELAY: Record<Group, number> = {
  eyes: 0,
  pupil: 50,
  brows: 110,
  mouth: 170,
  extra: 140,
  body: 230,
}
const DEF_SPR: Record<Group, Spring> = {
  eyes: [14, 0.82],
  pupil: [15, 0.8],
  brows: [11, 0.72],
  mouth: [12, 0.74],
  body: [7, 0.72],
  extra: [8, 0.5],
}
const CHOREO: Partial<Record<Expression, Choreo>> = {
  happy: {
    delay: {
      eyes: 0,
      pupil: 40,
      brows: 120,
      mouth: 200,
      extra: 220,
      body: 280,
    },
    spr: { body: [9, 0.42], extra: [9, 0.35] },
    keys: [
      [280, { alt: 0.2 }, { body: [11, 0.5] }],
      [520, { alt: 0.05 }, { body: [8, 0.38] }],
    ],
  },
  sad: {
    delay: {
      eyes: 0,
      pupil: 160,
      brows: 260,
      mouth: 380,
      extra: 420,
      body: 560,
    },
    spr: {
      eyes: [6, 0.95],
      pupil: [5, 0.95],
      brows: [6, 0.95],
      mouth: [6, 0.9],
      body: [3.2, 0.95],
      extra: [3, 0.9],
    },
  },
  angry: {
    delay: { brows: 0, eyes: 40, pupil: 60, mouth: 160, body: 100, extra: 60 },
    spr: { brows: [18, 0.7], eyes: [16, 0.75], body: [14, 0.5] },
  },
  sleepy: {
    delay: {
      eyes: 0,
      pupil: 200,
      brows: 750,
      mouth: 950,
      extra: 900,
      body: 1150,
    },
    spr: {
      eyes: [2.6, 1],
      pupil: [3, 1],
      brows: [3.2, 1],
      mouth: [3, 1],
      extra: [2.4, 0.9],
      body: [1.9, 1],
    },
    keys: [
      [0, { lid: 0.62 }],
      [1300, { lid: 1 }],
    ],
  },
  curious: {
    delay: { eyes: 0, pupil: 0, brows: 220, mouth: 320, extra: 0, body: 0 },
    spr: { body: [6, 0.95] },
    keys: [
      [0, { alt: -0.8, rot: 0, gx: 0, gy: -0.1, thing: 0 }],
      [900, { alt: -0.56 }, { body: [2.2, 1] }],
      [1500, { thing: 1 }, { extra: [5, 0.9] }],
      [2200, { look: 1 }, { pupil: [6, 0.9] }],
      [2500, { rot: 7 }, { body: [3, 0.9] }],
      [2900, { alt: -0.32 }, { body: [2, 1] }],
    ],
  },
  surprised: {
    delay: { eyes: 0, pupil: 0, brows: 0, mouth: 40, extra: 60, body: 0 },
    spr: {
      eyes: [30, 0.62],
      pupil: [26, 0.7],
      brows: [24, 0.55],
      mouth: [22, 0.6],
      extra: [15, 0.32],
    },
    keys: [
      [0, { alt: (v) => v - 0.1, sy: 0.9, sx: 1.05 }, { body: [30, 1] }],
      [110, { alt: 0.36, sy: 1.08, sx: 0.97 }, { body: [17, 0.42] }],
      [380, { sy: 1, sx: 1 }, { body: [10, 0.5] }],
    ],
  },
  excited: {
    delay: { eyes: 0, pupil: 30, brows: 80, mouth: 140, extra: 120, body: 180 },
    spr: { body: [9, 0.4], extra: [12, 0.3] },
  },
  confused: {
    delay: {
      eyes: 0,
      brows: 60,
      pupil: 100,
      mouth: 250,
      body: 200,
      extra: 200,
    },
    spr: { body: [5, 0.7] },
  },
  bored: {
    delay: {
      eyes: 0,
      pupil: 300,
      brows: 500,
      mouth: 600,
      extra: 700,
      body: 800,
    },
    spr: {
      eyes: [3, 1],
      pupil: [2.5, 1],
      brows: [3, 1],
      mouth: [3, 1],
      body: [1.6, 1],
      extra: [2, 1],
    },
  },
  attentive: {
    delay: {
      eyes: 0,
      pupil: 180,
      brows: 90,
      mouth: 240,
      extra: 200,
      body: 360,
    },
    spr: {
      eyes: [20, 0.8],
      pupil: [20, 0.85],
      brows: [16, 0.7],
      body: [5, 0.78],
      extra: [11, 0.4],
    },
  },
}

/* how much the pointer steers the eyes, and the blink interval, per state */
const ATTENTION: Record<Expression, number> = {
  normal: 0.8,
  happy: 0.6,
  sad: 0.2,
  angry: 0.6,
  sleepy: 0,
  curious: 1,
  surprised: 0.5,
  excited: 0.5,
  confused: 0.3,
  bored: 0.1,
  attentive: 1,
}
const BLINK: Record<Expression, [number, number] | null> = {
  normal: [2.4, 5],
  happy: [2.2, 4],
  sad: [3, 6],
  angry: [3.5, 6],
  sleepy: null,
  curious: [3.5, 6],
  surprised: [3, 5],
  excited: [1.8, 3.2],
  confused: [2, 4],
  bored: [4.5, 7.5],
  attentive: [4.5, 7.5],
}

/* the part of an activity's loop that restPose paints into a static pose */
function restLoop(activity: Activity, phase: number): Partial<Channels> {
  if (activity === 'idle') return {}
  const loop = activityLoop(activity, REST_T, phase)
  delete loop.alt
  delete loop.x
  return loop
}

/* a pulse closes over 120 ms; with no voice source the mouth then stays shut
 * for a second before the built-in flap comes back */
const PULSE_DECAY = 0.12
const PULSE_HOLD = 1

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const zero = () => {
  const o = {} as Channels
  for (const c of CHANNELS) o[c] = 0
  return o
}

/* ---------- the shared loop ---------- */

/* every bound avatar, and the ones the loop steps (not under reduced
 * motion) */
const ALL = new Set<Live>()
const LIVE = new Set<Live>()
let raf = 0
let last = 0
/* the longest step a frame may take, in seconds: a stalled tab or a caller's
 * huge dt never flings the springs */
const MAX_DT = 0.05

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

type Bump = {
  ch: Channel
  amt: number
  t0: number
  a: number
  h: number
  r: number
}
type Queued = { at: number; set: Key[1]; spr?: Key[2] }

/**
 * One live avatar bound to an SVG that already shows `tree`. Starts settled
 * in `expression` and `activity`, the same pose the server painted.
 */
export class Live {
  visible = true
  private state: Expression
  private activity: Activity
  private reduced: boolean
  private nodes = new Map<string, Element>()
  private prev = new Map<string, Record<string, string>>()
  private io: IntersectionObserver | null = null
  private clock = 0
  // when the loop clock last started at the static phase: at bind, and when
  // reduced motion turns off
  private loopStart = 0
  private enteredAt = 0
  private val: Channels
  private vel = zero()
  private base: Channels
  private spr = {} as Record<Channel, Spring>
  private out = zero()
  private queue: Queued[] = []
  private bumps: Bump[] = []
  private blinkAt = rand(1, 3)
  private blinkT = -1
  private blinkDur = 0.16
  private blinkV = 0
  private doubleBlink = false
  private saccAt = rand(0.6, 1.8)
  private sacc = { gx: 0, gy: 0 }
  private nodAt = 0
  private lookThing: boolean
  private lag = { y: 0, v: 0 }
  private swing: Swing = { angle: 0, vel: 0 }
  // the body's last position and velocity, for its acceleration
  private motion: { p: number[]; v: number[] } | null = null
  private fixed: Gaze | null = null
  private watch = false
  private rect: DOMRect | null = null
  // who the eyes follow instead of the pointer, and where that is this frame
  private gazeTarget: Live | Element | null = null
  private aim: [number, number] | null = null
  private phase: number
  private reaction: { name: Reaction; t0: number } | null = null
  private fxKind: FxKind | null = null
  private fxP = 0
  private voiceSrc: (() => number) | null = null
  private pulseAmt = 0
  private pulseAt = -1
  // the voice level painted last frame, -1 when the built-in flap runs
  private voice = -1

  constructor(
    private svg: SVGSVGElement,
    tree: Node,
    private who: Drawable,
    private opts: DrawOptions,
    expression: Expression,
    gaze?: Gaze | 'pointer',
    activity?: Activity,
  ) {
    this.state = expression
    this.activity = activityOf(activity)
    this.phase = loopPhase(who.key)
    this.bind(tree, svg)
    this.setGaze(gaze)
    const start = restPose(who, expression, this.gaze(), this.activity)
    this.val = { ...start }
    this.handOff()
    this.base = this.target()
    for (const c of CHANNELS) this.spr[c] = DEF_SPR[GROUP_OF[c]]
    this.lookThing =
      expression === 'curious' && !ACTIVITIES[this.activity].lockGaze
    this.lag.y = -start.alt * frameOf(FACES[who.face]).R
    this.reduced = reducedMotion()
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

  /**
   * The static pose carries the loop at its static phase: from here `out`
   * carries it, so the springs settle on the bare blend, and the loop clock
   * starts over at that phase so nothing jumps.
   */
  private handOff() {
    const rest = restLoop(this.activity, this.phase)
    this.out = zero()
    for (const c in rest) {
      this.val[c as Channel] -= rest[c as Channel]!
      this.out[c as Channel] = rest[c as Channel]!
    }
    this.loopStart = this.clock
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
    if (!reduced) {
      // pick up from the static frame snap() left: the trait sits still
      this.handOff()
      this.lag = { y: -this.val.alt * frameOf(FACES[this.who.face]).R, v: 0 }
      LIVE.add(this)
      run()
      return
    }
    LIVE.delete(this)
    this.snap()
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
      const { baseY, eyeY, R } = frameOf(FACES[t.who.face])
      const ex = 170 + t.val.x
      const ey = eyeY + baseY - t.val.alt * R
      return [
        r.left + ((ex - VB[0]) / VB[2]) * r.width,
        r.top + ((ey - VB[1]) / VB[3]) * r.height,
      ]
    }
    const r = t.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  }

  /**
   * Pairs every node in the tree with the element React rendered for it,
   * and remembers what that element shows now, which is not always `node`.
   */
  private bind(node: Node, el: Element) {
    this.nodes.set(node.key, el)
    const now: Record<string, string> = {}
    for (const a of Array.from(el.attributes))
      if (a.name !== 'class' && a.name !== 'style') now[a.name] = a.value
    this.prev.set(node.key, now)
    node.children.forEach((c, i) => {
      const child = el.children[i]
      if (child) this.bind(c, child)
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
    this.fixed = Array.isArray(gaze) ? (gaze as Gaze) : null
    this.watch = gaze === 'pointer'
    if (this.watch) listen()
    const g = this.gaze()
    if (this.reduced && g) {
      ;[this.val.gx, this.val.gy] = g
      this.paint()
    }
  }

  /** The fixed gaze, unless the activity holds the eyes itself. */
  private gaze(): Gaze | undefined {
    return this.fixed && !ACTIVITIES[this.activity].lockGaze
      ? this.fixed
      : undefined
  }

  /** The resting channel targets: expression and activity, then gaze. */
  private target(): Channels {
    const t = blend(this.state, this.activity)
    const g = this.gaze()
    if (g) [t.gx, t.gy] = g
    return t
  }

  /**
   * What the agent is doing. Springs retarget straight to the blended pose,
   * no choreography, so calling this every frame stays cheap; the activity's
   * loop rides on top. Under reduced motion the static pose applies at once.
   */
  setActivity(activity: Activity) {
    const a = activityOf(activity)
    if (a === this.activity) return
    this.activity = a
    // a pulse belongs to the speech it came with: none carries over
    this.pulseAt = -1
    if (this.reduced) {
      this.snap()
      return
    }
    const t = this.target()
    for (const c of CHANNELS) {
      this.base[c] = t[c]
      this.spr[c] = DEF_SPR[GROUP_OF[c]]
    }
    // a curious face goes back to the thing once its eyes are free, unless
    // its choreography has not reached that beat yet
    this.lookThing =
      !ACTIVITIES[a].lockGaze &&
      this.state === 'curious' &&
      !this.queue.some((q) => 'look' in q.set)
  }

  /**
   * The presence ring is state: it changes here, on the node the live tree
   * always carries, never through a new tree.
   */
  setRing(ring: Ring | null) {
    this.opts = {
      ...this.opts,
      ring:
        ring && typeof ring.color === 'string'
          ? {
              color: ring.color,
              progress: Number.isFinite(ring.progress ?? 1)
                ? clamp(ring.progress ?? 1, 0, 1)
                : 1,
              pulse: ring.pulse === true,
            }
          : null,
    }
    this.paint()
  }

  /* each group starts on its own beat */
  setExpression(name: Expression) {
    if (name === this.state) return
    const prev = this.state
    this.state = name
    this.enteredAt = this.clock
    this.lookThing = false
    this.queue = []
    const ch = CHOREO[name] ?? {}
    const delay = { ...DEF_DELAY, ...ch.delay }
    const spr = { ...DEF_SPR, ...ch.spr }
    if (this.reduced) {
      this.snap()
      return
    }
    for (const gr of Object.keys(GROUPS) as Group[]) {
      const set: Key[1] = {}
      // read when the group's beat comes, so an activity set meanwhile holds
      for (const c of GROUPS[gr]) set[c] = () => this.target()[c]
      this.queue.push({
        at: this.clock + delay[gr] / 1000,
        set,
        spr: { [gr]: spr[gr] },
      })
    }
    for (const [t, set, s] of ch.keys ?? [])
      this.queue.push({ at: this.clock + t / 1000 + 1e-4, set, spr: s })
    this.queue.sort((a, b) => a.at - b.at)
    // a startled face wakes with a double blink
    if (name === 'surprised') {
      this.blinkAt = this.clock + 0.75
      this.doubleBlink = true
    }
    if (name === 'sleepy') this.nodAt = this.clock + rand(6, 8)
    if (prev === 'sleepy') this.bumps = []
  }

  /**
   * A one-shot gesture on top of whatever the face is doing; a new one
   * replaces the running one. Unknown names and reduced motion do nothing.
   */
  react(name: Reaction) {
    const r = reactionOf(name)
    if (!r || this.reduced) return
    this.reaction = { name: r, t0: this.clock }
  }

  /**
   * A live mouth level, 0..1, read once a frame while the avatar speaks. It
   * replaces the built-in flap. NaN, infinities and out of range values are
   * treated as 0 or clamped. `null` takes the source away.
   */
  setVoice(source: (() => number) | null) {
    this.voiceSrc = typeof source === 'function' ? source : null
  }

  /**
   * One token or chunk of speech: opens the mouth by `strength` (0..1,
   * default 1) and lets it close over 120 ms. It does nothing unless the
   * avatar is speaking, or under reduced motion, which freezes the loops the
   * mouth rides on.
   */
  pulse(strength = 1) {
    if (this.reduced || this.activity !== 'speaking') return
    this.pulseAmt = Number.isFinite(strength) ? clamp(strength, 0, 1) : 1
    this.pulseAt = this.clock
  }

  /** The voice level now, or -1 when the built-in flap should run. */
  private level(): number {
    if (this.activity !== 'speaking') return -1
    const age = this.clock - this.pulseAt
    const pulsing = this.pulseAt >= 0 && age < PULSE_HOLD
    if (!this.voiceSrc && !pulsing) return -1
    let v = 0
    if (this.voiceSrc) {
      try {
        const x = Number(this.voiceSrc())
        v = Number.isFinite(x) ? clamp(x, 0, 1) : 0
      } catch {
        v = 0
      }
    }
    if (pulsing && age < PULSE_DECAY)
      v = Math.max(v, this.pulseAmt * (1 - age / PULSE_DECAY))
    return v
  }

  /** Straight to the rest pose of the current state, no motion. */
  private snap() {
    const rest = restPose(this.who, this.state, this.gaze(), this.activity)
    const base = this.target()
    for (const c of CHANNELS) {
      this.base[c] = base[c]
      this.val[c] = rest[c]
      this.vel[c] = 0
    }
    this.lookThing =
      this.state === 'curious' && !ACTIVITIES[this.activity].lockGaze
    this.queue = []
    this.bumps = []
    this.blinkT = -1
    this.blinkV = 0
    this.out = zero()
    this.reaction = null
    this.fxKind = null
    this.fxP = 0
    this.voice = -1
    this.swing = { angle: 0, vel: 0 }
    this.motion = null
    this.paint()
  }

  private bump(ch: Channel, amt: number, a: number, h: number, r: number) {
    this.bumps.push({ ch, amt, t0: this.clock, a, h, r })
  }

  step(elapsed: number) {
    // clamped here too, so a direct caller gets the same bounded step; the
    // swing below reads the same clamped dt
    const dt = Number.isFinite(elapsed) ? clamp(elapsed, 0, MAX_DT) : 0
    this.clock += dt
    const t = this.clock
    const age = t - this.enteredAt
    const st = this.state
    const face = FACES[this.who.face]
    while (this.queue.length && this.queue[0]!.at <= t) {
      const q = this.queue.shift()!
      if (q.spr)
        for (const gr of Object.keys(q.spr) as Group[]) {
          const s = q.spr[gr]
          if (s) for (const c of GROUPS[gr]) this.spr[c] = s
        }
      for (const c of Object.keys(q.set) as (Channel | 'look')[]) {
        if (c === 'look') {
          this.lookThing = true
          continue
        }
        const v = q.set[c]!
        this.base[c] = typeof v === 'function' ? v(this.val[c]) : v
      }
    }

    const tgt = zero()
    const out = zero()

    // gaze: resting target, micro saccades, the thing, the pointer
    // an activity that locks the gaze ignores the thing, a fixed gaze and
    // the pointer: its loop does the looking
    const lock = ACTIVITIES[this.activity].lockGaze
    let gx = this.base.gx
    let gy = this.base.gy
    if (this.lookThing && !lock)
      [gx, gy] = thingGaze(face, this.val.x, this.val.alt)
    if (this.fixed && !lock) [gx, gy] = this.fixed
    const still = st === 'sleepy' || st === 'bored' || lock
    if (!still && t >= this.saccAt) {
      this.sacc = { gx: rand(-0.17, 0.17), gy: rand(-0.1, 0.1) }
      this.saccAt = t + rand(0.8, 2.6)
    }
    if (!still) {
      gx += this.sacc.gx
      gy += this.sacc.gy
    }
    const w = ATTENTION[st]
    const r = this.rect
    const at = this.aim ?? pointer
    if (at && r && w > 0 && !lock) {
      if (r.width > 0) {
        const fx = VB[0] + ((at[0] - r.left) / r.width) * VB[2]
        const fy = VB[1] + ((at[1] - r.top) / r.height) * VB[3]
        const { baseY, eyeY, R } = frameOf(face)
        const ex = 170 + this.val.x
        const ey = eyeY + baseY - this.val.alt * R
        const px = clamp((fx - ex) / 170, -1, 1)
        const py = clamp((fy - ey) / 170, -1, 1)
        gx += (px - gx) * w
        gy += (py - gy) * w
      }
    }
    tgt.gx = gx - this.base.gx
    tgt.gy = gy - this.base.gy

    // per-state life
    const br =
      st === 'sleepy'
        ? 1.3
        : st === 'bored'
          ? 1.2
          : st === 'attentive'
            ? 2.6
            : 2.1
    const ba = st === 'sleepy' ? 0.018 : st === 'attentive' ? 0.004 : 0.007
    out.sy += ba * Math.sin(t * br)
    out.alt += (st === 'sleepy' ? 0.03 : 0.008) * Math.sin(t * br + 1.1)
    if (st === 'happy') out.rot += 1.4 * Math.sin(t * 1.7)
    if (st === 'angry') {
      out.x += 7 * Math.sin(age * 42) * Math.exp(-age * 6)
      out.x += 0.35 * Math.sin(t * 31)
    }
    if (st === 'excited') {
      const ph = age % 1.5
      if (ph < 0.9) {
        const h = Math.max(0, Math.sin((ph / 0.45) * Math.PI))
        out.alt += h * 0.17
        out.sy += h * 0.045
        out.rot += 2 * Math.sin(t * 9) * h
      }
    }
    if (st === 'confused') {
      tgt.gx += 0.45 * Math.sin(age * 1.1)
      out.rot += 2.2 * Math.sin(age * 0.7)
    }
    if (st === 'bored') tgt.gx += 0.22 * Math.sin(t * 0.33)
    if (st === 'sleepy' && t >= this.nodAt && age > 3) {
      // nods back up, half opens its eyes, gives in again
      this.bump('alt', 0.3, 0.14, 0.5, 1.6)
      this.bump('lid', -0.5, 0.14, 0.45, 1.3)
      this.bump('hair', 0.6, 0.12, 0.4, 1.2)
      this.nodAt = t + rand(6.5, 9.5)
    }
    // the activity's loop, additive after the springs so it stays crisp
    // On the loop clock, which starts at the static phase the server painted.
    // What the static pose leaves out (altitude and shiver, every idle
    // channel) eases in over the first half second instead of popping.
    const voice = this.level()
    this.voice = voice
    const lt = t - this.loopStart
    const loop = activityLoop(this.activity, REST_T + lt, this.phase, voice < 0)
    if (voice >= 0) {
      out.mb += 0.85 * voice
      out.mt -= 0.35 * voice
    }
    const ease = Math.min(1, lt / 0.5)
    for (const c in loop) {
      const painted = this.activity !== 'idle' && c !== 'alt' && c !== 'x'
      out[c as Channel] += loop[c as Channel]! * (painted ? 1 : ease)
    }
    if ((st === 'sad' || st === 'bored') && Math.random() < dt / 7) {
      this.bump('sy', -0.035, 0.5, 0.25, 0.9)
      this.bump('alt', -0.05, 0.5, 0.25, 0.9)
    }

    // springs, two substeps
    const h = dt / 2
    for (const c of CHANNELS) {
      const [om, ze] = this.spr[c]
      const target = this.base[c] + tgt[c]
      let x = this.val[c]
      let v = this.vel[c]
      for (let i = 0; i < 2; i++) {
        v += (om * om * (target - x) - 2 * ze * om * v) * h
        x += v * h
      }
      this.val[c] = x
      this.vel[c] = v
    }

    this.bumps = this.bumps.filter((b) => {
      const u = t - b.t0
      if (u > b.a + b.h + b.r) return false
      const e =
        u < b.a
          ? smooth(0, 1, u / b.a)
          : u < b.a + b.h
            ? 1
            : 1 - smooth(0, 1, (u - b.a - b.h) / b.r)
      out[b.ch] += b.amt * e
      return true
    })

    // blinks
    const bl = BLINK[st]
    let blink = 0
    if (bl && this.val.lid < 0.75) {
      if (this.blinkT < 0 && t >= this.blinkAt) {
        this.blinkT = 0
        this.blinkDur = st === 'bored' ? 0.42 : 0.16
      }
      if (this.blinkT >= 0) {
        this.blinkT += dt
        const u = this.blinkT / this.blinkDur
        if (u >= 1) {
          this.blinkT = -1
          if (this.doubleBlink) {
            this.doubleBlink = false
            this.blinkAt = t + 0.09
          } else {
            const k = this.who.persona.blink
            this.blinkAt = t + rand(bl[0] * k, bl[1] * k)
          }
        } else blink = Math.sin(u * Math.PI)
      }
    } else if (!bl) this.blinkT = -1
    this.blinkV = blink

    // the reaction, after the springs: additive, the blush takes the max
    this.fxKind = null
    this.fxP = 0
    const re = this.reaction
    if (re) {
      const spec = REACTIONS[re.name]
      const p = (t - re.t0) / spec.dur
      if (p >= 1) this.reaction = null
      else {
        const d = spec.at(Math.max(0, p))
        for (const c in d) {
          const v = d[c as Channel]!
          if (c === 'blush')
            out.blush += Math.max(0, v - (this.val.blush + out.blush))
          else out[c as Channel] += v
        }
        if (spec.fx) {
          this.fxKind = spec.fx
          this.fxP = Math.max(0, p)
        }
      }
    }

    // the trait lags behind the body a little
    const R = frameOf(face).R
    const avY = -(this.val.alt + out.alt) * R
    const lom = 10
    const lze = 0.32
    this.lag.v +=
      (lom * lom * (avY - this.lag.y) - 2 * lze * lom * this.lag.v) * dt
    this.lag.y += this.lag.v * dt

    // accessories swing on the body's acceleration (x, altitude, tilt)
    const p = [
      this.val.x + out.x,
      (this.val.alt + out.alt) * R,
      this.val.rot + out.rot,
    ]
    const m = this.motion
    if (this.reduced) this.motion = null
    else if (m && dt > 0) {
      const v = p.map((q, i) => (q - m.p[i]!) / dt)
      this.swing = stepSwing(
        this.swing,
        {
          x: (v[0]! - m.v[0]!) / dt,
          y: (v[1]! - m.v[1]!) / dt,
          rot: (v[2]! - m.v[2]!) / dt,
        },
        dt,
      )
      this.motion = { p, v }
    } else this.motion = { p, v: [0, 0, 0] }

    this.out = out
    this.paint()
  }

  private paint() {
    const R = frameOf(FACES[this.who.face]).R
    const pose = {
      blink: this.blinkV,
      expression: this.state,
      activity: this.activity,
      // reduced motion freezes loops and fx at the static phase
      t: REST_T + (this.reduced ? 0 : this.clock - this.loopStart),
      wob: this.reduced ? 0 : this.swing.angle,
      fx: this.fxKind,
      fxP: this.fxP,
      voice: this.reduced ? -1 : this.voice,
    } as Pose
    for (const c of CHANNELS) pose[c] = this.val[c] + this.out[c]
    pose.lag = this.reduced
      ? 0
      : clamp((this.lag.y + pose.alt * R) * 0.4, -16, 16)
    const ring = this.opts.ring
    const opts =
      this.reduced && ring?.pulse
        ? { ...this.opts, ring: { ...ring, pulse: false } }
        : this.opts
    this.write(draw(this.who, pose, opts))
  }
}
