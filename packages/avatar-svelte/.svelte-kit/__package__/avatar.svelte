<script lang="ts">
  import {
    draw,
    type Gaze,
    Live,
    type Node,
    type AvatarOptions,
    restPose,
    settle,
  } from '@awflow/avatar/adapter'
  import { untrack } from 'svelte'
  import NodeView from './node.svelte'

  type Props = Omit<AvatarOptions, 'gaze' | 'id'> & {
    name: string
    gaze?: Gaze | 'pointer'
    animate?: boolean
    id?: string
    class?: string
    style?: string
  }

  let {
    name,
    gaze,
    animate = false,
    id,
    class: className,
    style,
    ...rest
  }: Props = $props()

  const fixed = $derived(Array.isArray(gaze) ? (gaze as Gaze) : undefined)
  const settled = $derived(settle(name, { ...rest, gaze: fixed, id }, animate))
  const expression = $derived(rest.expression ?? 'normal')
  const sig = $derived(JSON.stringify([settled.who, settled.opts]))

  // the mount pose, captured once per {#key sig} instance (like useState).
  // untrack makes the intentional non-reactive read explicit to silence the
  // state_referenced_locally warning.
  const first = untrack(() => ({ expression: rest.expression ?? 'normal', gaze: fixed }))
  // animate: freeze the POSE at mount time so Svelte never fights the live rig,
  // but keep identity (who, opts) reactive so an identity change rebuilds correctly.
  const tree = $derived.by<Node>(() =>
    draw(
      settled.who,
      animate
        ? restPose(settled.who, first.expression, first.gaze)
        : settled.pose,
      settled.opts,
    ),
  )

  let svgEl = $state<SVGSVGElement>()
  let rig: Live | null = null

  $effect(() => {
    sig
    if (!animate) return
    return untrack(() => {
      if (!svgEl) return
      const l = new Live(
        svgEl,
        tree,
        settled.who,
        settled.opts,
        expression,
        gaze,
      )
      rig = l
      return () => {
        l.destroy()
        rig = null
      }
    })
  })
  $effect(() => {
    rig?.setExpression(expression)
  })
  $effect(() => {
    rig?.setGaze(gaze)
  })
</script>

{#key sig}
  <svg
    bind:this={svgEl}
    {...tree.attrs}
    {...(className !== undefined ? { class: className } : {})}
    {...(style !== undefined ? { style } : {})}
  >
    {#each tree.children as child (child.key)}
      <NodeView node={child} />
    {/each}
  </svg>
{/key}
