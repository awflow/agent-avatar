/*
 * <Avatar name="Ada" />: a deterministic avatar, static or alive, in Vue.
 *
 * Who owns the DOM: Vue renders the <svg> once per identity (toSvg's tree,
 * or the live tree when animated, on the server too), with ids from useId so
 * the server and the client agree. After mount the core's attach() adopts
 * that svg and owns everything inside it; Vue keeps only class and style,
 * which the core never touches. Vue never re-renders the svg's children:
 * their vnodes are built once per identity and marked memoized, so every
 * later patch hands Vue the very same vnode and it skips the subtree.
 *
 * State (expression, activity, gaze, ring, reaction/reactKey) only ever goes
 * to handle.set(), so the svg element stays the same. An identity change
 * (the core's isIdentityChange) re-keys the svg instead: Vue drops the old
 * one, renders the new one and attach() adopts that. The handle is never
 * sent an identity change, so it never rebuilds the svg itself.
 *
 * Inside <KeepAlive>, deactivating drops the handle (the rig stops) and
 * activating attaches again to the same svg, with the state last applied to
 * it (what it shows), then brings it up to date.
 */

import { LATEST } from '@awflow/avatar'
import {
  type AvatarHandle,
  attach,
  draw,
  type Gaze,
  isIdentityChange,
  type MountOptions,
  type Node,
  type Reaction,
  settle,
} from '@awflow/avatar/adapter'
import {
  computed,
  defineComponent,
  h,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  type PropType,
  shallowRef,
  useId,
  type VNode,
  watch,
  withMemo,
} from 'vue'
import { GroupKey } from './group'

/** Every option the core takes, minus the CSS-clashing `style` and `id`. */
export type AvatarProps = Omit<MountOptions, 'style' | 'id'>

/** What a template ref to <Avatar> exposes. Stable across identity changes. */
export type AvatarExposed = {
  /** The svg showing the avatar, null before mount. */
  readonly element: SVGSVGElement | null
  /** Plays a one-shot reaction. Animated avatars only. */
  react(name: Reaction): void
  /** A one-shot bounce, 0..1 (default 1). Animated avatars only. */
  pulse(strength?: number): void
  /** Lip-sync: a function returning the mouth opening 0..1, or null. */
  setVoice(source: (() => number) | null): void
  /** Looks at another avatar (its ref or handle) or an element; null ahead. */
  lookAt(target: AvatarExposed | AvatarHandle | Element | null): void
  /** The core handle once mounted, null before (and on the server). */
  getHandle(): AvatarHandle | null
}

/**
 * The svg id prefix for a useId value: `peek-` at version 1, `awf-` from
 * version 2, as the core's generated ids.
 */
export function domId(vueId: string, version?: number): string {
  const prefix = (version ?? LATEST) >= 2 ? 'awf' : 'peek'
  return `${prefix}-${vueId.replace(/[^\w-]/g, '')}`
}

/* any value: a null type is never cast to a boolean, absent stays undefined */
const opt = <T>() => ({ type: null as unknown as PropType<T> })

type P = Required<AvatarProps>

const props = {
  name: { type: String, required: true as const },
  size: opt<P['size']>(),
  theme: opt<P['theme']>(),
  version: opt<P['version']>(),
  framing: opt<P['framing']>(),
  frame: opt<P['frame']>(),
  square: opt<P['square']>(),
  expression: opt<P['expression']>(),
  activity: opt<P['activity']>(),
  gaze: opt<P['gaze']>(),
  animate: opt<P['animate']>(),
  fx: opt<P['fx']>(),
  ring: opt<P['ring']>(),
  dress: opt<P['dress']>(),
  shape: opt<P['shape']>(),
  color: opt<P['color']>(),
  eyes: opt<P['eyes']>(),
  brows: opt<P['brows']>(),
  mouth: opt<P['mouth']>(),
  cheeks: opt<P['cheeks']>(),
  trait: opt<P['trait']>(),
  motif: opt<P['motif']>(),
  headwear: opt<P['headwear']>(),
  eyewear: opt<P['eyewear']>(),
  neckwear: opt<P['neckwear']>(),
  face: opt<P['face']>(),
  decor: opt<P['decor']>(),
  prop: opt<P['prop']>(),
  title: opt<P['title']>(),
  riso: opt<P['riso']>(),
  lod: opt<P['lod']>(),
  reaction: opt<P['reaction']>(),
  reactKey: opt<unknown>(),
}

const KEYS = Object.keys(props) as (keyof typeof props)[]

/* what the server paints and attach() binds to: the live tree when
 * animated, toSvg's tree otherwise */
function build(o: MountOptions): Node {
  const {
    name,
    animate,
    reaction: _reaction,
    reactKey: _reactKey,
    gaze,
    ...look
  } = o
  const s = settle(
    name,
    { ...look, gaze: Array.isArray(gaze) ? (gaze as Gaze) : undefined },
    animate === true,
  )
  return draw(s.who, s.pose, s.opts)
}

function toVNode(node: Node): VNode {
  return h(
    node.tag,
    { key: node.key, ...node.attrs },
    node.children.map(toVNode),
  )
}

type Snapshot = {
  /** bumps on every identity change: the svg's key */
  gen: number
  o: MountOptions
  root: Record<string, string>
  children: VNode[]
}

function snapshot(o: MountOptions, gen: number): Snapshot {
  const tree = build(o)
  const cache: VNode[] = []
  return {
    gen,
    o,
    root: { ...tree.attrs },
    // withMemo (what v-memo compiles to) marks each vnode memoized: Vue
    // never clones it on a later patch, and patching a vnode against itself
    // is a no-op, so Vue never walks into the subtree the core owns.
    children: tree.children.map((c, i) =>
      withMemo([], () => toVNode(c), cache, i),
    ),
  }
}

type Bind = (svg: SVGSVGElement, snap: Snapshot) => () => void

/*
 * One avatar's <svg>, for one identity. Its root attributes and children
 * come from a snapshot that never changes for this instance, so a re-render
 * (new class or style) leaves what the core drew alone.
 */
const Svg = defineComponent({
  name: 'AvatarSvg',
  inheritAttrs: false,
  props: {
    snap: { type: Object as PropType<Snapshot>, required: true },
    bind: { type: Function as PropType<Bind>, required: true },
    cls: opt<unknown>(),
    css: opt<unknown>(),
  },
  setup(p) {
    const el = shallowRef<SVGSVGElement | null>(null)
    let release: (() => void) | null = null
    const open = () => {
      if (!release && el.value) release = p.bind(el.value, p.snap)
    }
    const close = () => {
      release?.()
      release = null
    }
    onMounted(open)
    onActivated(open)
    onDeactivated(close)
    onBeforeUnmount(close)
    return () => {
      const attrs: Record<string, unknown> = { ...p.snap.root, ref: el }
      if (p.cls !== undefined) attrs.class = p.cls
      if (p.css !== undefined) attrs.style = p.css
      return h('svg', attrs, p.snap.children)
    }
  },
})

/** Resolves an Avatar's exposed api to its core handle; else passes through. */
const resolve = (t: AvatarExposed | AvatarHandle | Element | null) =>
  t && 'getHandle' in t ? t.getHandle() : t

/** The state options last sent to the handle of snapshot `gen`. */
type Applied = { gen: number; state: Partial<MountOptions> }

export const Avatar = defineComponent({
  name: 'AwfAvatar',
  inheritAttrs: false,
  props,
  setup(p, { attrs, expose }) {
    const vueId = useId()

    const opts = (): MountOptions => {
      const o: Record<string, unknown> = {}
      for (const k of KEYS) if (p[k] !== undefined) o[k] = p[k]
      o.id = domId(vueId, p.version)
      return o as MountOptions
    }

    // one snapshot per identity: later state goes through the handle
    let last = snapshot(opts(), 0)
    const snap = computed(() => {
      const o = opts()
      if (isIdentityChange(last.o, o)) last = snapshot(o, last.gen + 1)
      return last
    })

    const state = (): Partial<MountOptions> => ({
      expression: p.expression,
      activity: p.activity,
      gaze: p.gaze,
      ring: p.ring,
      reaction: p.reaction,
      reactKey: p.reactKey,
    })

    const group = inject(GroupKey, null)
    let handle: AvatarHandle | null = null
    let handleGen = -1
    let applied: Applied | null = null
    let voice: (() => number) | null = null
    let target: AvatarExposed | AvatarHandle | Element | null = null

    const apply = (h: AvatarHandle, gen: number) => {
      const s = state()
      h.set(s)
      applied = { gen, state: s }
    }

    /*
     * Adopts the svg of snapshot `s`. It may be bound again without a
     * re-key (KeepAlive): by then the core may have redrawn it for a later
     * state, so attach() binds with the state it shows, not the snapshot's,
     * and set() brings it to the current one.
     */
    const bind: Bind = (svg, s) => {
      // same svg again: the state it shows. A new identity: the reactKey
      // the old handle last had, so a key that changed with it still plays
      // when apply() sends it
      const o = !applied
        ? s.o
        : applied.gen === s.gen
          ? { ...s.o, ...applied.state }
          : { ...s.o, reactKey: applied.state.reactKey }
      const h = attach(svg, o)
      if (voice) h.setVoice(voice)
      if (target) h.lookAt(resolve(target))
      const leave = group?.registerMember(s.o.name, h)
      handle = h
      handleGen = s.gen
      apply(h, s.gen)
      return () => {
        leave?.()
        if (handle === h) {
          handle = null
          handleGen = -1
        }
        h.destroy()
      }
    }

    // state only, never identity: see the note at the top. Stable keys, so
    // a new array or ring object with the same content changes nothing. The
    // handle plays a reaction only on a new reactKey.
    watch(
      [
        () => p.expression,
        () => p.activity,
        () => String(p.gaze),
        () => JSON.stringify(p.ring ?? null),
        () => p.reaction,
        () => p.reactKey,
      ],
      () => {
        // an identity change at the same time: the new svg binds with it
        if (handle && handleGen === snap.value.gen) apply(handle, handleGen)
      },
    )

    const exposed: AvatarExposed = {
      get element() {
        return handle?.element ?? null
      },
      react: (r) => handle?.react(r),
      pulse: (s) => handle?.pulse(s),
      setVoice(source) {
        voice = source
        handle?.setVoice(source)
      },
      lookAt(t) {
        target = t
        handle?.lookAt(resolve(t))
      },
      getHandle: () => handle,
    }
    expose(exposed)

    return () =>
      h(Svg, {
        key: snap.value.gen,
        snap: snap.value,
        bind,
        cls: attrs.class,
        css: attrs.style,
      })
  },
})
