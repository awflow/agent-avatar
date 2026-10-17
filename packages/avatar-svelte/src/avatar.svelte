<script lang="ts">
  /*
   * <Avatar>: a deterministic avatar, static or alive.
   *
   * Who owns the DOM: Svelte renders the <svg> once per identity (the
   * static toSvg tree, or the live tree when animated, on the server too),
   * then the core's attach() adopts it and owns everything inside it.
   * State (expression, activity, gaze, ring, reaction/reactKey) only ever
   * goes to handle.set(), so the svg element stays the same. An identity
   * change (isIdentityChange) re-keys the inner Root instead: Svelte drops
   * the old svg, renders the new one and attach() adopts that. The handle
   * is never sent an identity change, so it never rebuilds the svg itself.
   */
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
  import { untrack } from 'svelte'
  import { getGroupContext } from './group'
  import { domId } from './id'
  import Root from './root.svelte'

  /** Another <Avatar> (its component instance), as lookAt() takes it. */
  type AvatarInstance = { getHandle(): AvatarHandle | null }

  type Props = Omit<MountOptions, 'style' | 'id'> & {
    /** CSS class on the svg. */
    class?: string
    /** CSS style on the svg; pin a drawing version with `version`. */
    style?: string
  }

  let { class: className, style, ...rest }: Props = $props()

  // per instance and the same on the server and the client: the svg's defs
  // ids never collide with another avatar's on the page
  const uid = $props.id()
  const opts = $derived<MountOptions>({
    ...rest,
    id: domId(uid, rest.version),
  })

  // bumps on every identity change: the {#key} below rebuilds the svg
  let generation = 0
  let seen: MountOptions | undefined
  const sig = $derived.by(() => {
    const o = opts
    if (seen && isIdentityChange(seen, o)) generation++
    seen = o
    return generation
  })

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

  type Snapshot = { gen: number; o: MountOptions; tree: Node }

  // one snapshot per identity: later state goes through the handle
  const snap = $derived.by((): Snapshot => {
    const gen = sig
    return untrack(() => {
      const o = { ...opts }
      return { gen, o, tree: build(o) }
    })
  })

  const group = getGroupContext()
  /* the handle and the snapshot generation it was attached for */
  let current = $state.raw<{ handle: AvatarHandle; gen: number } | null>(null)
  let voice: (() => number) | null = null
  let target: AvatarInstance | AvatarHandle | Element | null = null
  /* the reactKey last sent to a handle, once one was sent */
  let sent: { reactKey: unknown } | null = null

  /** Resolves an Avatar instance to its handle; anything else passes. */
  const resolve = (t: AvatarInstance | AvatarHandle | Element | null) =>
    t && 'getHandle' in t ? t.getHandle() : t

  /*
   * Adopts the svg Root rendered for snapshot `s`. A reactKey that changed
   * together with the identity must still play, on the new handle: it is
   * attached with the key the old one last had, and the state effect below
   * then sends the new key.
   */
  function bind(svg: SVGSVGElement, s: Snapshot): () => void {
    const h = attach(svg, sent ? { ...s.o, reactKey: sent.reactKey } : s.o)
    if (voice) h.setVoice(voice)
    if (target) h.lookAt(resolve(target))
    const leave = group?.registerMember(s.o.name, h)
    current = { handle: h, gen: s.gen }
    return () => {
      leave?.()
      if (current?.handle === h) current = null
      h.destroy()
    }
  }

  // state only, never identity: see the note at the top. Only the handle of
  // the current identity takes it: a handle about to be replaced never does.
  $effect(() => {
    const c = current
    const gen = sig
    const { expression, activity, gaze, ring, reaction, reactKey } = opts
    if (c && c.gen === gen)
      untrack(() => {
        c.handle.set({ expression, activity, gaze, ring, reaction, reactKey })
        sent = { reactKey }
      })
  })

  /** Plays a one-shot reaction. Animated avatars only. */
  export function react(name: Reaction) {
    current?.handle.react(name)
  }

  /** A one-shot bounce, 0..1 (default 1). Animated avatars only. */
  export function pulse(strength?: number) {
    current?.handle.pulse(strength)
  }

  /** Lip-sync: a function returning the mouth opening 0..1, or null. */
  export function setVoice(source: (() => number) | null) {
    voice = source
    current?.handle.setVoice(source)
  }

  /**
   * Looks at another <Avatar> (its instance), a handle or an element; null
   * looks ahead. Another avatar is resolved to its handle now and again
   * whenever this one gets a new svg.
   */
  export function lookAt(t: AvatarInstance | AvatarHandle | Element | null) {
    target = t
    current?.handle.lookAt(resolve(t))
  }

  /** The core handle once mounted, null before (and on the server). */
  export function getHandle(): AvatarHandle | null {
    return current?.handle ?? null
  }

  /** The svg showing the avatar, null before mount (and on the server). */
  export function getElement(): SVGSVGElement | null {
    return current?.handle.element ?? null
  }
</script>

{#key sig}
  <Root {snap} {bind} class={className} {style} />
{/key}
