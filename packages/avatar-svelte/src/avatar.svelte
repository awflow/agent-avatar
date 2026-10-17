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
  import Root from './root.svelte'

  type Props = Omit<MountOptions, 'style'> & {
    /** CSS class on the svg. */
    class?: string
    /** CSS style on the svg; pin a drawing version with `version`. */
    style?: string
  }

  let { class: className, style, ...rest }: Props = $props()

  const opts = $derived<MountOptions>({ ...rest })

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

  // one snapshot per identity: later state goes through the handle
  const snap = $derived.by(() => {
    sig
    return untrack(() => {
      const o = { ...opts }
      return { o, tree: build(o) }
    })
  })

  const group = getGroupContext()
  let handle = $state.raw<AvatarHandle | null>(null)
  let voice: (() => number) | null = null
  let target: AvatarHandle | Element | null = null

  function adopt(h: AvatarHandle) {
    if (voice) h.setVoice(voice)
    if (target) h.lookAt(target)
    const leave = group?.registerMember(untrack(() => opts.name), h)
    handle = h
    return () => {
      leave?.()
      if (handle === h) handle = null
    }
  }

  // state only, never identity: see the note at the top
  $effect(() => {
    const h = handle
    const { expression, activity, gaze, ring, reaction, reactKey } = opts
    if (h)
      untrack(() =>
        h.set({ expression, activity, gaze, ring, reaction, reactKey }),
      )
  })

  /** Plays a one-shot reaction. Animated avatars only. */
  export function react(name: Reaction) {
    handle?.react(name)
  }

  /** A one-shot bounce, 0..1 (default 1). Animated avatars only. */
  export function pulse(strength?: number) {
    handle?.pulse(strength)
  }

  /** Lip-sync: a function returning the mouth opening 0..1, or null. */
  export function setVoice(source: (() => number) | null) {
    voice = source
    handle?.setVoice(source)
  }

  /** Looks at another avatar's handle or an element; null looks ahead. */
  export function lookAt(t: AvatarHandle | Element | null) {
    target = t
    handle?.lookAt(t)
  }

  /** The core handle once mounted, null before (and on the server). */
  export function getHandle(): AvatarHandle | null {
    return handle
  }
</script>

{#key sig}
  <Root tree={snap.tree} opts={snap.o} {adopt} class={className} {style} />
{/key}
