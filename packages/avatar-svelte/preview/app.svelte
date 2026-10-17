<script lang="ts">
  import { Avatar } from '../src/index'

  const names = ['Ada Lovelace', 'Linh', 'Doan Labs', 'Grace Hopper', '東京']
  const expressions = [
    'normal',
    'happy',
    'sad',
    'angry',
    'surprised',
    'curious',
    'sleepy',
    'excited',
  ] as const

  let expression = $state<(typeof expressions)[number]>('happy')
  let animate = $state(true)
</script>

<main style="font-family: system-ui; padding: 24px">
  <div style="display: flex; gap: 16px; align-items: center">
    <label>
      expression
      <select bind:value={expression}>
        {#each expressions as e (e)}
          <option value={e}>{e}</option>
        {/each}
      </select>
    </label>
    <label>
      <input type="checkbox" bind:checked={animate} />
      animate
    </label>
  </div>

  <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 24px">
    {#each names as name (name)}
      <Avatar {name} {expression} {animate} gaze="pointer" size={120} riso />
    {/each}
  </div>
</main>
