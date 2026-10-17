<script lang="ts">
  /*
   * Test-only: an <AvatarGroup> with members A, B and C, B optional. Kept
   * outside src so svelte-package never ships it. Each member's instance
   * lands in `refs` under its name.
   */
  import AvatarGroup from '../src/avatar-group.svelte'
  import Avatar from '../src/avatar.svelte'

  let {
    speaker,
    withB = true,
    refs,
  }: {
    speaker?: string
    withB?: boolean
    refs: Record<string, any>
  } = $props()
</script>

<AvatarGroup {speaker}>
  <Avatar bind:this={refs.A} name="A" animate />
  {#if withB}
    <Avatar bind:this={refs.B} name="B" animate />
  {/if}
  <Avatar bind:this={refs.C} name="C" animate />
</AvatarGroup>
