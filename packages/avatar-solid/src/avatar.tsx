/*
 * <Avatar name="Ada" />: a deterministic avatar, static or alive, in Solid.
 *
 * Who owns the DOM: Solid renders a <span style="display:contents"> and
 * fills it once, through innerHTML, with the serialized svg (toSvg's tree,
 * or the live tree when animated), on the server and the client alike, with
 * ids from createUniqueId so the two agree. The markup is computed once, in
 * the component body, outside any tracking scope, so Solid never writes it
 * again; while hydrating Solid skips innerHTML altogether and keeps the
 * server's svg. On mount the core's attach() adopts span.firstElementChild
 * and from then on the core alone owns everything inside the span.
 *
 * One owner for every later change: the handle. Every prop change goes to
 * handle.set(). State (expression, activity, gaze, ring, reaction/reactKey)
 * changes the svg in place; an identity change (the core's
 * isIdentityChange) makes the handle rebuild the svg itself, replacing it
 * inside the span, destroying the old Live and starting a new one, with
 * class, style, voice and gaze target carried over. The handle lives as long
 * as the component, so it is never attached twice to the same svg.
 */

import { LATEST } from '@awflow/avatar'
import {
  type AvatarHandle,
  attach,
  draw,
  type Gaze,
  type MountOptions,
  type Reaction,
  serialize,
  settle,
} from '@awflow/avatar/adapter'
import {
  createEffect,
  createUniqueId,
  type JSX,
  on,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  useContext,
} from 'solid-js'
import { GroupContext } from './group'

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

export type AvatarProps = Omit<MountOptions, 'style' | 'id'> & {
  /** CSS class on the svg. */
  class?: string
  /** CSS style on the svg; pin a drawing version with `version`. */
  style?: string | JSX.CSSProperties
  /** Receives the avatar's ref once, when it is created. */
  ref?: AvatarRef | ((ref: AvatarRef) => void)
}

/**
 * The svg id prefix for a createUniqueId value: `peek-` at version 1,
 * `awf-` from version 2, as the core's generated ids.
 */
export function domId(solidId: string, version?: number): string {
  const prefix = (version ?? LATEST) >= 2 ? 'awf' : 'peek'
  return `${prefix}-${solidId.replace(/[^\w-]/g, '')}`
}

/* a style prop as the attribute text the server writes */
function cssText(style: AvatarProps['style']): string | undefined {
  if (style == null || typeof style === 'string') return style || undefined
  const parts: string[] = []
  for (const [k, v] of Object.entries(style))
    if (v != null && v !== '') parts.push(`${k}:${v}`)
  return parts.length ? parts.join(';') : undefined
}

/* what the server paints and attach() binds to: the live tree when
 * animated, toSvg's tree otherwise, with class and style on the root */
function markup(o: MountOptions, cls?: string, css?: string): string {
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
  const tree = draw(s.who, s.pose, s.opts)
  const attrs = { ...tree.attrs }
  if (cls) attrs.class = cls
  if (css) attrs.style = css
  return serialize({ ...tree, attrs })
}

/* writes an attribute only when it differs: hydration writes nothing */
function sync(el: Element, name: string, value: string | undefined) {
  if (!value) {
    if (el.hasAttribute(name)) el.removeAttribute(name)
  } else if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}

/** Resolves an AvatarRef to its core handle; anything else passes through. */
const resolve = (t: AvatarRef | AvatarHandle | Element | null) =>
  t && 'getHandle' in t ? t.getHandle() : t

export function Avatar(props: AvatarProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'style', 'ref'])
  const uid = createUniqueId()
  const opts = (): MountOptions =>
    ({ ...rest, id: domId(uid, rest.version) }) as MountOptions

  const group = useContext(GroupContext)
  let span!: HTMLSpanElement
  let handle: AvatarHandle | null = null
  let voice: (() => number) | null = null
  let target: AvatarRef | AvatarHandle | Element | null = null

  const ref: AvatarRef = {
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
  ;(local.ref as ((r: AvatarRef) => void) | undefined)?.(ref)

  // once: Solid never writes the span's content again
  const html = untrack(() => markup(opts(), local.class, cssText(local.style)))

  onMount(() => {
    const h = attach(span.firstElementChild as SVGSVGElement, opts())
    handle = h
    if (voice) h.setVoice(voice)
    if (target) h.lookAt(resolve(target))

    // every later change, state or identity, goes to the handle; it plays
    // a reaction only on a new reactKey
    createEffect(on(opts, (o) => h.set(o), { defer: true }))

    // the group matches members by name: follow a rename
    createEffect(() => {
      const leave = group?.registerMember(props.name, h)
      onCleanup(() => leave?.())
    })

    // after the set() above, so a rebuilt svg gets the new values
    createEffect(() => {
      const cls = local.class
      const css = cssText(local.style)
      sync(h.element, 'class', cls)
      sync(h.element, 'style', css)
    })

    onCleanup(() => {
      if (handle === h) handle = null
      h.destroy()
    })
  })

  return <span ref={span} style='display:contents' innerHTML={html} />
}
