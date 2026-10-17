# @awflow/avatar-element

Deterministic SVG avatars from a name, as `<awf-avatar>` custom elements. Built
on [Peek](https://peek.doan-labs.com) by Doan Labs.

```sh
npm install @awflow/avatar-element @awflow/avatar
```

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
`label`, `riso`, `reaction`, `react-key`.

- Numbers use `Number()`; a value that is NaN is ignored.
- `gaze="x,y"` is clamped to -1..1, or `gaze="pointer"`.
- Booleans (`animate`, `dress`, `riso`, `square`) are true by presence;
  `="false"` means false.
- `ring` is JSON: `ring='{"color":"#f90","progress":0.5}'`.
- `label` is the accessible name (the core `title` option). The global `title`
  attribute is not observed, so no native tooltip appears.
- Removing any attribute resets its option, so the core default applies.
- A mounted avatar replaces the element's children. Content inside an
  `<awf-avatar>` shows as a fallback until the avatar mounts (it needs a
  `name`); it is only cleared once an svg has been rendered.
- Invalid values are ignored and the previous value stays.
- Each element gets its own SVG ids (`awf-e1`, `awf-e2`..., `peek-` at
  version 1), so two identical avatars on one page never share defs.

Methods: `react(name)`, `pulse(strength?)`, `setVoice(fn | null)`,
`lookAt(target)` (target may be another `<awf-avatar>`, followed as it mounts, moves or remounts), and `handle`.
Properties `ring`, `gaze`, `reaction` and `reactKey` accept objects directly.

`defineAvatarElements(prefix = 'awf')` registers the tags under another prefix.
Importing in Node is safe and defines nothing.

## Docs

Full documentation: <https://github.com/awflow/avatar#readme>

## License

Built on Peek by Doan Labs. [MIT](./LICENSE) © Doan Labs, © AWFlow
