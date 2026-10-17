/*
 * The rig on a fake DOM, shared by every Live test file: rAF never fires
 * (each test drives step() itself), the IntersectionObserver is inert and
 * reduced motion is a switch.
 */
import { afterAll, beforeAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { Live } from '../animate'
import { draw } from '../draw'
import { type AvatarOptions, serialize, settle } from '../svg'

// one switch for every test file: the rig caches the first query it sees,
// so the query reads this object live
const g = globalThis as any
g.__motion ??= { reduce: false }
export const motion: { reduce: boolean } = g.__motion

/** Registers the fake DOM for the calling test file. */
export function fakeDom() {
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
  const count = () => svg.querySelectorAll('*').length
  return { live, svg, count, who, opts, tree, rig: live as any }
}
