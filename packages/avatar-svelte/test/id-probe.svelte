<script lang="ts">
  /*
   * Test-only: shows the `$props.id()` the first component of a render
   * gets, so the SSR tests know the id an <Avatar> rendered alone uses.
   */
  const id = $props.id()
</script>

<i>{id}</i>
