# @awflow/avatar-element

Deterministic SVG avatars from a name, as `<awf-avatar>` custom elements. Built
on [Peek](https://peek.doan-labs.com) by Doan Labs.

```html
<script type="module">
  import '@awflow/avatar-element' // defines <awf-avatar> and <awf-avatar-group>
</script>

<awf-avatar-group speaker="Ada">
  <awf-avatar name="Ada" animate></awf-avatar>
  <awf-avatar name="Linh" expression="happy" size="96"></awf-avatar>
</awf-avatar-group>
```

Light DOM, no framework. Attributes are the options: `name`, `size`, `theme`,
`version`, `framing`, `frame`, `square`, `expression`, `activity`, `gaze`,
`animate`, `fx`, `ring`, `dress`, the identity axes, the wardrobe, `prop`,
`title`, `riso`, `reaction`, `react-key`.

- Numbers use `Number()`; a value that is NaN is ignored.
- `gaze="x,y"` is clamped to -1..1, or `gaze="pointer"`.
- Booleans (`animate`, `dress`, `riso`, `square`) are true by presence;
  `="false"` means false.
- `ring` is JSON: `ring='{"color":"#f90","progress":0.5}'`.
- Invalid values are ignored and the previous value stays.

Methods: `react(name)`, `pulse(strength?)`, `setVoice(fn | null)`,
`lookAt(target)` (target may be another `<awf-avatar>`), and `handle`.
Properties `ring`, `gaze`, `reaction` and `reactKey` accept objects directly.

`defineAvatarElements(prefix = 'awf')` registers the tags under another prefix.
Importing in Node is safe and defines nothing.
