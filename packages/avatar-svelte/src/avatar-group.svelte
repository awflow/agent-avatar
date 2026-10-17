<script lang="ts">
  /*
   * <AvatarGroup speaker="Ada">: the avatars inside look at whoever is
   * speaking; the speaker looks ahead. No wrapper element is rendered.
   */
  import type { Snippet } from 'svelte'
  import { createGroup, setGroupContext } from './group'

  let { speaker, children }: { speaker?: string; children?: Snippet } =
    $props()

  const group = createGroup()
  setGroupContext(group)

  $effect(() => {
    group.setSpeaker(speaker)
  })
</script>

{@render children?.()}
