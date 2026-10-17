<script lang="ts">
  /*
   * One avatar's <svg>, for one identity. Svelte renders it once (on the
   * server, or on the client's first paint) from a tree that never changes
   * afterwards; on mount, attach() adopts it and from then on the core owns
   * everything inside it. Svelte keeps only class and style, which the core
   * never touches. A new identity is a new instance of this component.
   */
  import type { MountOptions, Node } from '@awflow/avatar/adapter'
  import { onMount } from 'svelte'
  import NodeView from './node.svelte'

  type Snapshot = { gen: number; o: MountOptions; tree: Node }

  let {
    snap,
    bind,
    class: className,
    style,
  }: {
    snap: Snapshot
    /** Attaches the core to the svg; returns the release. */
    bind: (svg: SVGSVGElement, snap: Snapshot) => () => void
    class?: string
    style?: string
  } = $props()

  let svg: SVGSVGElement

  onMount(() => bind(svg, snap))
</script>

<svg
  bind:this={svg}
  {...snap.tree.attrs}
  {...(className !== undefined ? { class: className } : {})}
  {...(style !== undefined ? { style } : {})}
>
  {#each snap.tree.children as child (child.key)}
    <NodeView node={child} />
  {/each}
</svg>
