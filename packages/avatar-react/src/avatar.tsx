/*
 * <Avatar name="Ada" />: a deterministic avatar, static or alive, in React.
 *
 * Who owns the DOM: React renders the <svg> once per identity (toSvg's tree,
 * or the live tree when animated, on the server too), with ids from useId so
 * the server and the client agree. After mount the core's attach() adopts
 * that svg and owns everything inside it; React keeps only className and
 * style, which the core never touches. React never re-renders the svg's
 * children: they are built once per identity and handed back unchanged, so
 * React bails out of them and never fights the core.
 *
 * State (expression, activity, gaze, ring, reaction/reactKey) only ever goes
 * to handle.set(), so the svg element stays the same. An identity change
 * (the core's isIdentityChange) re-keys the svg instead: React drops the old
 * one, renders the new one and attach() adopts that. The handle is never
 * sent an identity change, so it never rebuilds the svg itself.
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
  type CSSProperties,
  createElement,
  forwardRef,
  memo,
  type ReactElement,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { GroupContext } from './group'

export type AvatarProps = Omit<MountOptions, 'style' | 'id'> & {
  /** CSS class on the svg. */
  className?: string
  /** CSS style on the svg; pin a drawing version with `version`. */
  style?: CSSProperties
}

/** What a ref to <Avatar> holds. Stable across identity changes. */
export type AvatarRef = {
  /** The svg showing the avatar, null before mount. */
  readonly element: SVGSVGElement | null
  /** Plays a one-shot reaction. Animated avatars only. */
  react(name: Reaction): void
  /** A one-shot bounce, 0..1 (default 1). Animated avatars only. */
  pulse(strength?: number): void
  /** Lip-sync: a function returning the mouth opening 0..1, or null. */
  setVoice(source: (() => number) | null): void
  /** Looks at another avatar (its ref or handle) or an element; null ahead. */
  lookAt(target: AvatarRef | AvatarHandle | Element | null): void
  /** The core handle once mounted, null before (and on the server). */
  getHandle(): AvatarHandle | null
}

/**
 * The svg id prefix for a useId value: `peek-` at version 1, `awf-` from
 * version 2, as the core's generated ids.
 */
export function domId(reactId: string, version?: number): string {
  const prefix = (version ?? LATEST) >= 2 ? 'awf' : 'peek'
  return `${prefix}-${reactId.replace(/[^\w-]/g, '')}`
}

// no layout effects on the server: React 18 warns about them there
const useIsoLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect

const camel = (k: string) =>
  k.startsWith('aria-') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

function toReact(node: Node): ReactElement {
  const props: Record<string, unknown> = { key: node.key }
  for (const k in node.attrs) props[camel(k)] = node.attrs[k]
  return createElement(node.tag, props, ...node.children.map(toReact))
}

function rootProps(node: Node): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const k in node.attrs) props[camel(k)] = node.attrs[k]
  return props
}

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

type Snapshot = {
  /** bumps on every identity change: the svg's key */
  gen: number
  o: MountOptions
  tree: Node
  root: Record<string, unknown>
  children: ReactElement[]
}

function snapshot(o: MountOptions, gen: number): Snapshot {
  const tree = build(o)
  return {
    gen,
    o,
    tree,
    root: rootProps(tree),
    children: tree.children.map(toReact),
  }
}

type SvgProps = {
  snap: Snapshot
  adopt: (handle: AvatarHandle) => () => void
  className?: string
  style?: CSSProperties
}

/*
 * One avatar's <svg>, for one identity. Its root attributes and children
 * come from a snapshot that never changes for this instance, so a re-render
 * (new className or style) leaves what the core drew alone.
 */
const Svg = memo(function Svg({ snap, adopt, className, style }: SvgProps) {
  const ref = useRef<SVGSVGElement>(null)
  useIsoLayoutEffect(() => {
    const handle = attach(ref.current!, snap.o)
    const release = adopt(handle)
    return () => {
      release()
      handle.destroy()
    }
  }, [snap, adopt])
  return createElement(
    'svg',
    { ...snap.root, ref, className, style },
    ...snap.children,
  )
})

/** Resolves an AvatarRef to its core handle; anything else passes through. */
const resolve = (t: AvatarRef | AvatarHandle | Element | null) =>
  t && 'getHandle' in t ? t.getHandle() : t

export const Avatar = forwardRef<AvatarRef, AvatarProps>(function Avatar(
  { className, style, ...rest },
  ref,
) {
  const id = domId(useId(), rest.version)
  const o: MountOptions = { ...rest, id }

  // one snapshot per identity: later state goes through the handle
  const [snap, setSnap] = useState(() => snapshot(o, 0))
  let current = snap
  if (isIdentityChange(snap.o, o)) {
    current = snapshot(o, snap.gen + 1)
    setSnap(current)
  }

  const group = useContext(GroupContext)
  const handle = useRef<AvatarHandle | null>(null)
  const voice = useRef<(() => number) | null>(null)
  const target = useRef<AvatarRef | AvatarHandle | Element | null>(null)
  const name = useRef(o.name)
  name.current = o.name

  const adopt = useMemo(
    () => (h: AvatarHandle) => {
      if (voice.current) h.setVoice(voice.current)
      if (target.current) h.lookAt(resolve(target.current))
      const leave = group?.registerMember(name.current, h)
      handle.current = h
      return () => {
        leave?.()
        if (handle.current === h) handle.current = null
      }
    },
    [group],
  )

  // state only, never identity: see the note at the top. The handle skips
  // what did not change, and plays a reaction only on a new reactKey.
  const { expression, activity, gaze, ring, reaction, reactKey } = rest
  useIsoLayoutEffect(() => {
    handle.current?.set({
      expression,
      activity,
      gaze,
      ring,
      reaction,
      reactKey,
    })
  })

  useImperativeHandle(
    ref,
    () => ({
      get element() {
        return handle.current?.element ?? null
      },
      react: (r) => handle.current?.react(r),
      pulse: (s) => handle.current?.pulse(s),
      setVoice(source) {
        voice.current = source
        handle.current?.setVoice(source)
      },
      lookAt(t) {
        target.current = t
        handle.current?.lookAt(resolve(t))
      },
      getHandle: () => handle.current,
    }),
    [],
  )

  return createElement(Svg, {
    key: current.gen,
    snap: current,
    adopt,
    className,
    style,
  })
})
