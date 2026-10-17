<script lang="ts">
  /*
   * One avatar's <svg>, for one identity. Svelte renders it once (on the
   * server, or on the client's first paint) from a tree that never changes
   * afterwards; on mount, attach() adopts it and from then on the core owns
   * everything inside it. Svelte keeps only class and style, which the core
   * never touches. A new identity is a new instance of this component.
   */
  import {
    type AvatarHandle,
    attach,
    type MountOptions,
    type Node,
  } from '@awflow/avatar/adapter'
  import { onMount } from 'svelte'
  import NodeView from './node.svelte'

  let {
    tree,
    opts,
    adopt,
    class: className,
    style,
  }: {
    tree: Node
    opts: MountOptions
    adopt: (handle: AvatarHandle) => () => void
    class?: string
    style?: string
  } = $props()

  let svg: SVGSVGElement

  onMount(() => {
    const handle = attach(svg, opts)
    const release = adopt(handle)
    return () => {
      release()
      handle.destroy()
    }
  })
</script>

<svg
  bind:this={svg}
  {...tree.attrs}
  {...(className !== undefined ? { class: className } : {})}
  {...(style !== undefined ? { style } : {})}
>
  {#each tree.children as child (child.key)}
    <NodeView node={child} />
  {/each}
</svg>
