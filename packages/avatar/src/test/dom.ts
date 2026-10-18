/*
 * The rig on a fake DOM, shared by every Live test file: rAF never fires
 * (each test drives step() itself), the IntersectionObserver is inert and
 * reduced motion is a switch.
 */
import { afterAll, afterEach, beforeAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { Live } from '../animate'
import { draw } from '../draw'
import { type AvatarOptions, serialize, settle } from '../svg'

// one switch for every test file: the rig caches the first query it sees,
// so the query reads this object live
const g = globalThis as any
g.__motion ??= { reduce: false }
export const motion: { reduce: boolean } = g.__motion

/* every Live this helper binds, destroyed after each test so none leaks
 * into the module-level registry another test file counts */
const made = new Set<Live>()

/** Registers the fake DOM for the calling test file. */
export function fakeDom() {
  afterEach(() => {
    for (const live of made) live.destroy()
    made.clear()
  })
  beforeAll(() => {
    GlobalRegistrator.register()
    globalThis.requestAnimationFrame = () => 1
    globalThis.cancelAnimationFrame = () => {}
    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    } as any
    globalThis.matchMedia = ((q: string) => ({
      get matches() {
        return motion.reduce && q.includes('reduce')
      },
      addEventListener() {},
    })) as any
  })
  afterAll(async () => {
    // the cached query outlives this file: leave reduced motion off
    motion.reduce = false
    await GlobalRegistrator.unregister()
  })
}

/** Paints the live tree for `name` into a fresh svg and binds a Live to it. */
export function mount(name: string, o: AvatarOptions = {}, reduced = false) {
  motion.reduce = reduced
  const { who, pose, opts } = settle(name, o, true)
  const tree = draw(who, pose, opts)
  const host = document.createElement('div')
  host.innerHTML = serialize(tree)
  const svg = host.querySelector('svg') as unknown as SVGSVGElement
  const live = new Live(
    svg,
    tree,
    who,
    opts,
    o.expression ?? 'normal',
    o.gaze,
    o.activity,
  )
  made.add(live)
  const count = () => svg.querySelectorAll('*').length
  return { live, svg, count, who, opts, tree, rig: inside(live) }
}

/**
 * The Live and the Rig it drives, seen as one object, for tests that read
 * internals: a name the Live has is the Live's, any other is the Rig's.
 */
export function inside(live: Live): any {
  const l = live as any
  return new Proxy(l, {
    get(t, k) {
      if (k in t) return Reflect.get(t, k)
      const v = Reflect.get(t.rig, k)
      return typeof v === 'function' ? v.bind(t.rig) : v
    },
    set(t, k, v) {
      return k in t || !(k in t.rig)
        ? Reflect.set(t, k, v)
        : Reflect.set(t.rig, k, v)
    },
  })
}
