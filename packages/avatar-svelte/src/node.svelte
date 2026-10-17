<svelte:options namespace="svg" />

<script lang="ts">
  import type { Node } from '@awflow/avatar/adapter'
  import Self from './node.svelte'

  let { node }: { node: Node } = $props()
</script>

<svelte:element this={node.tag} {...node.attrs}>
  {#each node.children as child (child.key)}
    <Self node={child} />
  {/each}
</svelte:element>
