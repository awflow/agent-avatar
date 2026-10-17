/*
 * The docs, once. Every page renders from these blocks on /docs, and the
 * same blocks become Markdown for /llms.txt, /llms-full.txt and the prompt a
 * visitor copies. Option lists are read from the library, never typed.
 *
 * A code block tagged `check` is typechecked against the workspace packages
 * by scripts/check-snippets.ts; `prelude` declares what the snippet leaves
 * out (a model call, a level meter) and is never shown.
 */
import {
  ACTIVITIES,
  EXPRESSIONS,
  FACES,
  FX_KINDS,
  LATEST,
  LISTS,
  PROPS,
  REACTIONS,
  THEMES,
  VERSIONS,
} from '@awflow/avatar'
import type { AvatarProps } from '@awflow/avatar-react'
import { FRAMEWORKS, INSTALL, type Look, snippet } from './frameworks.ts'

export const SITE = 'https://[docs domain]'
export const REPO = 'https://github.com/awflow/agent-avatar'
export const PEEK = 'https://peek.doan-labs.com'

export type Lang = 'tsx' | 'ts' | 'bash' | 'svelte' | 'vue' | 'html' | 'diff'

export type Face = Omit<AvatarProps, 'name'> & { name: string; label?: string }

/** A string is a paragraph; `code` in backticks stays code. */
export type Block =
  | string
  | { h: string }
  | {
      code: string
      lang: Lang
      title?: string
      /** Typechecked by scripts/check-snippets.ts. */
      check?: true
      /** Hidden declarations the check prepends. */
      prelude?: string
    }
  | { list: string[] }
  | { rows: string[][] }
  /** Live faces on the page; Markdown skips them. */
  | { faces: Face[]; size?: number }
  /** The seven ways in, as tabs; Markdown prints every one. */
  | { frameworks: { name: string; look: Look } }

export type DocPage = {
  slug: string
  /** The sidebar heading it sits under. */
  group: 'Get started' | 'The face' | 'Extend' | 'Project'
  title: string
  blurb: string
  /** What the copied prompt asks an agent to do. */
  task: string
  blocks: Block[]
}

const one = (list: readonly string[]) => list.map((v) => `\`${v}\``).join(' ')
const EXPR = Object.keys(EXPRESSIONS)
const ACTS = Object.keys(ACTIVITIES)
const REACTS = Object.keys(REACTIONS)
const SHAPES = Object.keys(FACES)
const THEME_NAMES = Object.keys(THEMES)
const wear = (list: readonly string[]) => list.filter((v) => v !== 'none')
/** Every wardrobe item a slot can take, `none` left out. */
export const WEAR_COUNT = [
  LISTS.headwear,
  LISTS.eyewear,
  LISTS.neckwear,
  LISTS.decor,
].reduce((n, l) => n + wear(l).length, 0)

export const PAGES: DocPage[] = [
  {
    slug: '',
    group: 'Get started',
    title: 'Get started',
    blurb: 'One core, seven ways in.',
    task: 'Add @awflow/avatar to this app wherever an agent, a user or an account is shown without a photo.',
    blocks: [
      'The core renders strings and runs the rig. Each adapter is a thin component around it, so every framework gets the same faces, byte for byte. Pick yours:',
      {
        frameworks: {
          name: 'Linh',
          look: {
            theme: 'bold',
            activity: 'working',
            animate: true,
            gaze: 'pointer',
          },
        },
      },
      { h: 'Same name, same face' },
      'Nothing is stored and nothing is fetched. The face is worked out from the name every time, so the server and the browser draw the same one. The name is tidied first (trimmed, spaces collapsed, lowercased), so `Linh` and ` linh ` are the same face.',
      {
        faces: [
          { name: 'Linh', label: 'Linh' },
          { name: ' linh ', label: '" linh "' },
          { name: 'Ada', label: 'Ada' },
          { name: 'Grace', label: 'Grace' },
        ],
      },
      { h: 'A static face, anywhere' },
      '`toSvg` is a string function with no runtime dependencies. It runs on servers, at the edge and in workers:',
      {
        code: `import { toSvg } from '@awflow/avatar'

export function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') ?? 'Linh'
  return new Response(toSvg(name, { size: 128, theme: 'bold' }), {
    headers: { 'content-type': 'image/svg+xml' },
  })
}`,
        lang: 'ts',
        check: true,
      },
      { h: 'Alive' },
      '`animate` brings the face to life after mount: blinks, saccades, breathing, the activity loop and accessory physics, all on one shared animation loop that pauses off-screen. Under `prefers-reduced-motion` durations drop to none and the pose stays. State props (`expression`, `activity`, `gaze`, `ring`) change the face in place and never re-render the svg.',
      {
        code: `import { Avatar } from '@awflow/avatar-react'

export function Agent({ name, busy }: { name: string; busy: boolean }) {
  return (
    <Avatar
      name={name}
      animate
      gaze='pointer'
      activity={busy ? 'working' : 'idle'}
      expression={busy ? 'attentive' : 'happy'}
    />
  )
}`,
        lang: 'tsx',
        check: true,
      },
      `Current drawing version: \`${LATEST}\`. See [Frameworks](/docs/frameworks) for server rendering and ids, and the [API](/docs/api) for every prop.`,
    ],
  },
  {
    slug: 'frameworks',
    group: 'Get started',
    title: 'Frameworks',
    blurb: 'Server rendering, ids and the small print of each adapter.',
    task: 'Wire @awflow/avatar into this framework correctly: server rendering, ids, plugins and the imperative handle.',
    blocks: [
      'Every adapter renders the svg on the server with the same tree the client adopts after hydration. The core then owns everything inside the svg; the framework keeps only `class` and `style`.',
      { h: 'Ids on one page' },
      'Gradients and clip paths need ids. Each adapter takes them from the framework, so two identical avatars never share defs and the server and client agree: `useId` in React and Vue, `$props.id()` in Svelte, `createUniqueId` in Solid, and a per-page counter (`awf-e1`, `awf-e2`...) in the web component. Ids start with `awf-`, or `peek-` at version 1.',
      {
        list: [
          'Vue: two Vue apps on one page hand out the same `useId` values. Give each app its own prefix with `app.config.idPrefix`.',
          'Islands and several render roots: each root counts ids on its own, so two islands can hand out the same id. Give each root a prefix: React `identifierPrefix` on `createRoot`, `hydrateRoot` and `renderToString`; Svelte `idPrefix` on `render`, `mount` and `hydrate`; Vue `app.config.idPrefix`.',
          'Web component: load `@awflow/avatar-element` once per page. Two bundled copies keep two counters.',
        ],
      },
      {
        code: `import { createSSRApp } from 'vue'
import App from './App.vue'

const app = createSSRApp(App)
app.config.idPrefix = 'chat'`,
        lang: 'ts',
      },
      { h: 'Plugins and the server' },
      "Register the same plugins on the server and the client, before the first render. An override that names a plugin one side never registered draws the name's own pick there instead, so the server frame and the first live paint disagree (warned once in development).",
      { h: 'Pointing one avatar at another' },
      '`lookAt(other)` in React, Vue and Solid resolves the other avatar when you call it. If that avatar later changes identity (a new name or theme rebuilds its svg), call `lookAt` again. `<awf-avatar>` keeps following its target as it mounts, moves or remounts. Inside an `AvatarGroup`, everyone looks at the `speaker` and the speaker looks ahead.',
      {
        code: `import { Avatar, AvatarGroup } from '@awflow/avatar-react'

export function Call({ speaker }: { speaker: string }) {
  return (
    <AvatarGroup speaker={speaker}>
      <Avatar name='Ada' animate />
      <Avatar name='Linh' animate />
    </AvatarGroup>
  )
}`,
        lang: 'tsx',
        check: true,
      },
      { h: 'State is replaced, not mutated' },
      'Pass a new object when a `ring` or a `gaze` pair changes. An object changed in place keeps the same reference, so no adapter sees the change.',
      { h: 'Svelte' },
      'Svelte 5.20 or later. Bind the component to call `react`, `pulse`, `setVoice`, `lookAt`, `getHandle` and `getElement`.',
      {
        code: `<script lang="ts">
  import { Avatar } from '@awflow/avatar-svelte'

  let avatar: Avatar | undefined = $state()
</script>

<Avatar bind:this={avatar} name="Ada" animate />
<button onclick={() => avatar?.react('wink')}>Wink</button>`,
        lang: 'svelte',
        check: true,
        prelude: 'declare function $state<T>(initial?: T): T',
      },
      { h: 'Vue' },
      "Vue 3.5 or later. Exposed methods: `react`, `pulse`, `setVoice`, `lookAt`. Inside `<KeepAlive>` a deactivated avatar stops its rig and catches up when activated again. Other attributes are not forwarded: the core owns the svg's own attributes.",
      { h: 'Solid' },
      'Solid 1.9 or later, with a hydratable DOM build and a server build. Each avatar renders `<span style="display:contents">` around its svg, which takes no space in layout. The ref is handed over once and stays the same object for the component\'s life.',
      { h: 'Web component' },
      {
        list: [
          'Light DOM, no framework. Attributes are the options; `ring` is JSON, `gaze="x,y"` or `gaze="pointer"`.',
          'Booleans (`animate`, `dress`, `riso`, `square`) are true by presence, and `="false"` means false, as Vue and Lit write them.',
          '`label` is the accessible name. The global `title` attribute is not observed, so no native tooltip appears.',
          "A mounted avatar replaces the element's children. Content inside `<awf-avatar>` shows as a fallback until the avatar mounts.",
          'Removing an attribute resets its option; an invalid value is ignored and the previous one stays.',
          '`defineAvatarElements(prefix)` registers the tags under another prefix. Importing in Node defines nothing.',
        ],
      },
      "The bare `import '@awflow/avatar-element'` needs a bundler or an import map. Without either, import the module from a CDN:",
      {
        code: `<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@awflow/avatar-element@1/+esm'
</script>

<awf-avatar name="Ada" animate></awf-avatar>`,
        lang: 'html',
      },
      {
        code: `<awf-avatar-group speaker="Ada">
  <awf-avatar name="Ada" animate></awf-avatar>
  <awf-avatar name="Linh" expression="happy" size="96" dress="false">
    <img src="/linh.png" alt="Linh">
  </awf-avatar>
</awf-avatar-group>`,
        lang: 'html',
      },
      { h: 'Vanilla' },
      '`mount(el, options)` renders into an element; `attach(svg, options)` adopts an svg the server rendered. Both return a handle with `set`, `react`, `pulse`, `setVoice`, `lookAt` and `destroy`.',
      {
        code: `import { mount } from '@awflow/avatar'

const el = document.querySelector('#agent')!
const agent = mount(el, { name: 'Ada', animate: true, gaze: 'pointer' })

agent.set({ activity: 'thinking' })
agent.react('nod')`,
        lang: 'ts',
        check: true,
      },
    ],
  },
  {
    slug: 'api',
    group: 'Get started',
    title: 'API',
    blurb: 'Every prop, every option, every method.',
    task: 'Use the @awflow/avatar API in this app: pick the props this design needs.',
    blocks: [
      'Components take these as props, `toSvg(name, options)` and `mount(el, { name, ...options })` take them as options, `<awf-avatar>` takes them as attributes.',
      {
        rows: [
          ['Prop', 'Type', 'What it does'],
          ['`name`', '`string`', 'Required. Decides the whole identity.'],
          [
            '`theme`',
            `${one(THEME_NAMES)} or a custom name`,
            'Palette, frame, line and light. Default `soft`.',
          ],
          ['`expression`', `${EXPR.length} values`, EXPR.join(', ')],
          ['`activity`', `${ACTS.length} values`, ACTS.join(', ')],
          [
            '`reaction` · `reactKey`',
            `${REACTS.length} gestures`,
            `Plays \`reaction\` each time \`reactKey\` changes after mount: ${REACTS.join(', ')}.`,
          ],
          [
            '`gaze`',
            "`[x, y]` · `'pointer'`",
            'Where the eyes look, -1..1. `pointer` follows the pointer (animated only).',
          ],
          [
            '`framing`',
            '`peek` · `full`',
            "Peek's cropped portrait, or the whole body for bubbles and stickers.",
          ],
          [
            '`frame`',
            '`ink` · `bone` · `paper` · `none` · `theme`',
            "The background fill. Default the theme's; `none` is transparent.",
          ],
          ['`square`', '`boolean`', '`false` clips the frame to a circle.'],
          [
            '`size`',
            '`number` (px)',
            'Drives the stroke ramp; detail thins out under 44 and 24 px.',
          ],
          [
            '`shape` · `color` · `eyes` · `brows` · `mouth` · `cheeks` · `trait` · `motif`',
            'override one axis',
            'Everything else stays hashed from the name. `color` also takes a hex.',
          ],
          [
            '`headwear` · `eyewear` · `neckwear` · `decor` · `prop`',
            'wardrobe',
            'Explicit items. `face` is an alias of `decor` from version 2.',
          ],
          ['`dress`', '`boolean`', 'Let the name pick the wardrobe too.'],
          [
            '`ring`',
            '`{ color, progress?, pulse? }`',
            'Presence or progress around the frame. State, not identity.',
          ],
          ['`animate`', '`boolean`', 'The rig on or off. Default off.'],
          [
            '`fx`',
            '`boolean` · `string`',
            'Overlays on (default) or off, or one overlay by name.',
          ],
          [
            '`version` · `style`',
            "`number` · `'peek@1'` · `'peek@2'`",
            `Pin the drawing version. Default the latest, \`${LATEST}\`. Components take \`version\` only: their \`style\` is CSS.`,
          ],
          ['`riso`', '`boolean`', 'Riso plates and grain, from 120 px up.'],
          ['`lod`', '`boolean`', 'Level of detail. On from version 2.'],
          [
            '`title`',
            '`string` · `false`',
            'Accessible name, default the name; `false` marks it decorative.',
          ],
        ],
      },
      { h: 'Methods' },
      'A ref (React, Solid), an exposed instance (Vue), a bound component (Svelte), the element itself (`<awf-avatar>`) or the handle from `mount` all carry the same calls:',
      {
        rows: [
          ['Method', 'What it does'],
          ['`react(name)`', 'Plays a one-shot reaction. Animated only.'],
          ['`pulse(strength?)`', 'A one-shot bounce, 0..1. Animated only.'],
          [
            '`setVoice(fn | null)`',
            'Lip-sync: a function that returns the mouth opening, 0..1.',
          ],
          [
            '`lookAt(target | null)`',
            'Looks at another avatar or an element; `null` looks ahead.',
          ],
        ],
      },
      { h: 'Exports' },
      {
        rows: [
          ['Entry', 'Exports'],
          [
            '`@awflow/avatar`',
            '`toSvg` `mount` `attach` `frames` `identify` `defineTheme` `defineAccessory` `defineProp` `defineFx` `defineShape` `registerPlugins` `THEMES` `LISTS` `REACTIONS` `ACTIVITIES` `EXPRESSIONS` `FRAME_LIMITS`',
          ],
          ['`@awflow/avatar/svg`', '`toSvg` `settle` `serialize`, no rig'],
          ['`@awflow/avatar/identity`', '`identify` alone'],
          ['`@awflow/avatar/ai`', '`lookSchema` `lookPrompt` `parseLook`'],
          ['`@awflow/avatar/compat`', '`fromLegacy` `lookForRole` `ARIA`'],
          [
            '`@awflow/avatar-export`',
            '`toPng` `toApng` `toGif` `toSprite` `init` `LIMITS`',
          ],
        ],
      },
    ],
  },
  {
    slug: 'themes',
    group: 'The face',
    title: 'Themes',
    blurb: 'Five built in. Yours in ten lines.',
    task: 'Theme the @awflow/avatar faces in this app to match its design, with a built-in theme or defineTheme.',
    blocks: [
      'A theme owns the twelve body colours, the structure inks (features, eyes, frame), the shading and the outline. Swap the theme, keep the person: the identity never changes.',
      {
        faces: THEME_NAMES.map((theme) => ({
          name: 'Linh',
          theme,
          label: theme,
        })),
        size: 104,
      },
      {
        rows: [
          ['Theme', 'Look'],
          [
            '`soft`',
            "Peek's palette and the default. Without a theme, output stays byte-identical to Peek.",
          ],
          ['`bold`', 'Saturated bodies with a bold shade.'],
          ['`mono`', 'Ink lines on paper, no colour.'],
          ['`neon`', 'Glowing outlines on a night frame.'],
          ['`clay`', 'Soft clay shading with highlights.'],
        ],
      },
      { h: 'Your own' },
      'Start from a built-in theme and change what you need. `defineTheme` registers it by name and returns it, so it also works as a plugin:',
      {
        code: `import { defineTheme, THEMES } from '@awflow/avatar'

export const sunset = defineTheme({
  ...THEMES.clay,
  name: 'sunset',
  frame: '#2B1B2E',
  colors: {
    ...THEMES.clay.colors,
    peach: { body: '#FF9E7A', deep: '#E0623D' },
  },
  ink: () => '#2B1B2E',
  motifs: true, // let the hash pick textures
  shading: 'clay', // flat · bold · clay
})`,
        lang: 'ts',
        check: true,
      },
      {
        code: `<Avatar name="Linh" theme="sunset" />`,
        lang: 'tsx',
      },
      {
        list: [
          'Built-in names cannot be replaced. A custom name defined again from a new object replaces the old one (last wins), which is what hot module reload does.',
          'Colours are normalised to lowercase `#rrggbb`.',
          'Define the theme on the server and the client, before the first render.',
        ],
      },
    ],
  },
  {
    slug: 'shapes',
    group: 'The face',
    title: 'Shapes & parts',
    blurb: 'Fifteen bodies, one set of anchors.',
    task: 'Use @awflow/avatar identity axes in this app: stable avatars per user, with overrides where the design needs them.',
    blocks: [
      'Each axis hashes on its own seed and picks from its list. Pass any axis and it wins; every other axis stays as the name made it.',
      {
        faces: SHAPES.map((shape) => ({ name: 'Linh', shape, label: shape })),
        size: 80,
      },
      {
        code: `<Avatar name="Linh" shape="flower" color="mint" eyes="spark" />`,
        lang: 'tsx',
      },
      { h: 'Axes' },
      {
        rows: [
          ['Axis', 'Options'],
          ['`shape`', one(SHAPES)],
          ['`color`', `${one(LISTS.color)}, or any \`#rgb\` / \`#rrggbb\``],
          ['`eyes`', one(LISTS.eyes)],
          ['`brows`', one(LISTS.brows)],
          ['`mouth`', one(LISTS.mouth)],
          ['`cheeks`', one(LISTS.cheeks)],
          ['`trait`', one(LISTS.trait)],
          ['`motif`', one(LISTS.motif)],
        ],
      },
      "The `rays` motif is reserved for Aria, AWFlow's assistant: the hash never picks it and the AI helpers leave it out.",
      { h: 'Versions' },
      "Lists only ever grow at the end, and the hash reads a version's own slice of each list. Pin a version and today's faces never change:",
      {
        rows: [
          ['Version', 'Shapes', 'Colours', 'Eyes', 'Motifs'],
          ...Object.entries(VERSIONS).map(([v, n]) => [
            `\`${v}\``,
            String(n.face),
            String(n.color),
            String(n.eyes),
            String(n.motif),
          ]),
        ],
      },
      {
        code: `toSvg('Linh', { version: 1 }) // Peek's face, byte for byte`,
        lang: 'ts',
      },
    ],
  },
  {
    slug: 'expressions',
    group: 'The face',
    title: 'Expressions & activities',
    blurb: 'How it feels, and what it is doing.',
    task: 'Show agent state in this app with @awflow/avatar expressions and activities.',
    blocks: [
      `${EXPR.length} expressions set how the face feels:`,
      {
        faces: EXPR.map((expression) => ({
          name: 'Ada',
          expression: expression as Face['expression'],
          label: expression,
        })),
        size: 80,
      },
      `${ACTS.length} activities layer what an agent is doing on top, with an overlay where it helps: happy while working, worried while waiting for you.`,
      {
        faces: ACTS.map((activity) => ({
          name: 'Ada',
          theme: 'bold',
          activity: activity as Face['activity'],
          label: activity,
        })),
        size: 80,
      },
      {
        rows: [
          ['Activity', 'Overlay'],
          ...Object.entries(ACTIVITIES).map(([k, v]) => [
            `\`${k}\``,
            v.fx.length ? v.fx.map((f) => `\`${f}\``).join(' ') : 'none',
          ]),
        ],
      },
      {
        code: `<Avatar name="Ada" expression="happy" activity="working" animate />`,
        lang: 'tsx',
      },
      '`fx={false}` hides every overlay; `fx="hearts"` draws one by name. Overlays: ' +
        one(FX_KINDS) +
        '.',
    ],
  },
  {
    slug: 'motion',
    group: 'The face',
    title: 'Reactions & motion',
    blurb: 'Motion that means something.',
    task: 'Make the @awflow/avatar faces in this app respond: reactions, gaze, lip-sync and groups.',
    blocks: [
      'Springs, blinks, saccades, reactions and accessory physics run on one shared loop. It writes DOM attributes only, pauses off-screen, and under `prefers-reduced-motion` cuts every duration to none while keeping the pose.',
      { h: 'Reactions' },
      `${REACTS.length} one-shot gestures: ${one(REACTS)}. Call \`react\` on the ref, or set \`reaction\` and change \`reactKey\`:`,
      {
        code: `import { Avatar, type AvatarRef } from '@awflow/avatar-react'
import { useRef } from 'react'

export function Cheer() {
  const ref = useRef<AvatarRef>(null)
  return (
    <button type='button' onClick={() => ref.current?.react('celebrate')}>
      <Avatar ref={ref} name='Ada' animate />
    </button>
  )
}`,
        lang: 'tsx',
        check: true,
      },
      { h: 'Gaze' },
      'A fixed `[x, y]` in -1..1, `pointer` to follow the pointer, or `lookAt` another avatar or element.',
      { h: 'Voice' },
      '`setVoice` takes a function the loop reads every frame, returning the mouth opening from 0 to 1. Feed it an audio meter for lip-sync:',
      {
        code: `import { mount } from '@awflow/avatar'

const ada = mount(document.querySelector('#ada')!, {
  name: 'Ada',
  animate: true,
  activity: 'speaking',
})
ada.setVoice(() => meter.level) // 0..1, read every frame
ada.pulse(0.5)`,
        lang: 'ts',
        check: true,
        prelude: 'declare const meter: { level: number }',
      },
      { h: 'Ring' },
      'A presence ring, or progress around the frame. `pulse` breathes it on a live avatar. It is state, so changing it never rebuilds the svg.',
      {
        faces: [
          { name: 'Ada', ring: { color: '#22c55e' }, label: 'online' },
          {
            name: 'Linh',
            ring: { color: '#b45309', progress: 0.65 },
            label: 'progress 0.65',
          },
          {
            name: 'Grace',
            ring: { color: '#3b82f6', pulse: true },
            animate: true,
            label: 'pulse',
          },
        ],
        size: 80,
      },
      { h: 'Frames for video' },
      '`frames(name, options, settings)` renders an animation as deterministic SVG strings, one per frame. The export package rasterises them into APNG and GIF.',
    ],
  },
  {
    slug: 'wardrobe',
    group: 'The face',
    title: 'Wardrobe & props',
    blurb: `${WEAR_COUNT} items across four slots, plus ${wear(PROPS).length} held props.`,
    task: 'Dress the @awflow/avatar faces in this app with wardrobe items and held props.',
    blocks: [
      "Wardrobe items are drawn on the face's anchors, so a hat fits every shape and glasses sit on the eyes whatever the persona. Items keep gaze and blink, swing on their own springs and follow every expression.",
      {
        faces: [
          { name: 'Linh', headwear: 'wizard', label: 'wizard' },
          { name: 'Linh', eyewear: 'visor', label: 'visor' },
          {
            name: 'Linh',
            headwear: 'crown',
            neckwear: 'bowtie',
            label: 'crown · bowtie',
          },
          {
            name: 'Linh',
            headwear: 'headphones',
            decor: 'freckles',
            label: 'headphones · freckles',
          },
          { name: 'Linh', prop: 'coffee', label: 'coffee' },
        ],
        size: 96,
      },
      {
        rows: [
          ['Slot', 'Items'],
          ['`headwear`', one(wear(LISTS.headwear))],
          ['`eyewear`', one(wear(LISTS.eyewear))],
          ['`neckwear`', one(wear(LISTS.neckwear))],
          ['`decor` (`face`)', one(wear(LISTS.decor))],
          ['`prop`', one(wear(PROPS))],
        ],
      },
      {
        code: `<Avatar name="Linh" headwear="wizard" prop="coffee" activity="thinking" />
<Avatar name="Bao" dress /> {/* the name picks the outfit */}`,
        lang: 'tsx',
      },
      {
        list: [
          'Every slot defaults to `none`; `dress` lets the hash pick the outfit as part of the identity.',
          'Props are held beside the body and follow the work: the bulb lights while thinking, the coffee steams.',
          'Hats scale with the head and sit on the crown; neckwear hangs from the neck line and the floor clips it.',
          'Wardrobe items are never hashed unless `dress` is on, so existing faces stay unchanged.',
        ],
      },
    ],
  },
  {
    slug: 'plugins',
    group: 'Extend',
    title: 'Plugins',
    blurb: 'Draw a new hat once. It fits every face.',
    task: 'Add a custom @awflow/avatar plugin (accessory, prop, overlay, shape or theme) to this app.',
    blocks: [
      "Accessories and props receive the face's geometry (crown, eyes, head width, mouth line), the live pose and the theme, so a custom item blinks, bobs and wobbles with everything else. Overlays receive anchors and the loop clock.",
      {
        code: `import {
  crownTop,
  defineAccessory,
  el,
  registerPlugins,
  swingOf,
} from '@awflow/avatar'

export const catEars = defineAccessory({
  slot: 'headwear',
  name: 'cat-ears',
  physics: { stiffness: 10, damping: 0.2, maxSwing: 18 },
  draw: (ctx) => {
    const { x, y } = crownTop(ctx.sh)
    const tilt = swingOf(ctx.pose, 'headwear')
    const ear = (side: -1 | 1) =>
      el('path', side < 0 ? 'left' : 'right', {
        d: \`M\${x + side * 12} \${y + 10}L\${x + side * 40} \${y - 44}L\${x + side * 66} \${y + 24}Z\`,
        fill: ctx.ink.body,
        stroke: ctx.theme.ink(ctx.ink),
        'stroke-width': 4,
        transform: \`rotate(\${tilt} \${x} \${y})\`,
      })
    return [ear(-1), ear(1)]
  },
})

registerPlugins([catEars]) // <Avatar headwear="cat-ears" />`,
        lang: 'ts',
        check: true,
      },
      {
        rows: [
          ['Define', 'Adds'],
          [
            '`defineAccessory`',
            'A `headwear`, `eyewear`, `neckwear` or `decor` item. Headwear and neckwear may swing on a spring.',
          ],
          ['`defineProp`', 'A held prop.'],
          [
            '`defineFx`',
            'An overlay: `shapes(t, progress, anchor)` returns paths.',
          ],
          ['`defineShape`', 'A body silhouette with its anchors.'],
          ['`defineTheme`', 'A theme; see [Themes](/docs/themes).'],
        ],
      },
      { h: 'Rules' },
      {
        list: [
          'A plugin is reachable only by an explicit override (`headwear="cat-ears"`). It never joins the hashed lists, so a name keeps its face whatever is registered.',
          'Names are lowercase letters, digits and dashes, starting with a letter. Built-in names cannot be replaced.',
          'Hot module reload: registering a fresh object with the same kind and name replaces the old one, warned once.',
          'Server rendering: register the same plugins on the server and the client, before the first render, or the first live paint disagrees with the server frame.',
          'A draw that throws or returns non-finite numbers is skipped for that render and reported once; return the same nodes every frame.',
        ],
      },
    ],
  },
  {
    slug: 'export',
    group: 'Extend',
    title: 'Export & CLI',
    blurb: 'Out of the browser, into everything.',
    task: 'Export @awflow/avatar faces from this project as PNG, APNG, GIF or sprite sheets.',
    blocks: [
      '`@awflow/avatar-export` turns avatars into PNG, animated PNG, GIF and sprite sheets, in Node and the browser. It rasterises with resvg compiled to WebAssembly, so the same name and options give the same bytes on every machine.',
      { code: 'npm i @awflow/avatar-export @awflow/avatar', lang: 'bash' },
      {
        code: `import { toApng, toGif, toPng, toSprite } from '@awflow/avatar-export'

const png = await toPng('Linh', { expression: 'happy' }, { size: 512 })
const apng = await toApng('Linh', { reaction: 'hop' }, { fps: 30, seconds: 3 })
const gif = await toGif('Linh', { frame: 'none', activity: 'done' })
const sheet = await toSprite(['Ada', 'Linh', 'Sam'], {}, { size: 64, gap: 4 })`,
        lang: 'ts',
        check: true,
      },
      { h: 'In the browser' },
      'Load the wasm once with `init` before the first export:',
      {
        code: `import { init, toPng } from '@awflow/avatar-export'
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url' // Vite

await init(fetch(wasmUrl))
const png = await toPng('Linh')`,
        lang: 'ts',
      },
      { h: 'Limits' },
      '`LIMITS` is `{ maxFrames: 600, maxSize: 1024, maxSprite: 400, maxSheet: 16777216 }`. A value out of range throws a `RangeError` that names the limit, before anything is drawn. Keep GIFs at 50 fps or less; APNG timing is exact.',
      { h: 'Command line' },
      '`awflow-avatar` ships with the core and needs nothing else for SVG. Raster flags load `@awflow/avatar-export`.',
      {
        code: `npx @awflow/avatar Linh --theme bold --activity done > linh.svg
printf 'Linh\\nBao\\nAda\\n' | npx @awflow/avatar sheet - > team.svg

npx @awflow/avatar-export Linh --gif 256 --fps 12 --seconds 2 > linh.gif
npx @awflow/avatar-export sheet names.txt --sprite --size 128 > team.png`,
        lang: 'bash',
      },
      {
        rows: [
          ['Flag', 'Values'],
          ['`--theme`', one(THEME_NAMES)],
          ['`--shape`', 'any shape'],
          ['`--expression` · `--activity`', 'any expression, any activity'],
          [
            '`--framing` · `--frame`',
            '`peek` `full` · `ink` `bone` `paper` `none` `theme`',
          ],
          ['`--size`', 'pixels'],
          ['`--dress`', 'let the name pick the wardrobe'],
          [
            '`--color` `--eyes` `--brows` `--mouth` `--cheeks` `--trait` `--motif` `--eyewear` `--headwear` `--neckwear` `--decor`',
            'override one axis',
          ],
          [
            '`--png <n>` · `--gif <n>` · `--sprite`',
            'raster output, with `--fps` and `--seconds` for GIF',
          ],
        ],
      },
      'A bad flag or value prints one line on stderr and exits 1. Runs on Node 20 or later.',
    ],
  },
  {
    slug: 'ai',
    group: 'Extend',
    title: 'AI looks',
    blurb: 'Describe a look. Your model returns it.',
    task: 'Let users describe an avatar look in words in this app, using @awflow/avatar/ai with our existing model.',
    blocks: [
      'There is no model inside the package: `@awflow/avatar/ai` gives you a JSON Schema of every overridable axis, a system prompt and a forgiving validator. Your model returns overrides; the validator keeps what is valid and drops the rest. Registered plugins and themes are included.',
      {
        code: `import { toSvg } from '@awflow/avatar'
import { lookPrompt, lookSchema, parseLook } from '@awflow/avatar/ai'

const answer = await llm({
  system: lookPrompt(),
  schema: lookSchema(),
  input: 'a sleepy wizard who loves coffee',
})
const look = parseLook(answer) // { headwear: 'wizard', prop: 'coffee', eyes: 'bead' }
const svg = toSvg('Merlin', look)`,
        lang: 'ts',
        check: true,
        prelude:
          'declare function llm(o: { system: string; schema: object; input: string }): Promise<unknown>',
      },
      {
        list: [
          '`lookSchema()`: JSON Schema (draft 2020-12), built at call time.',
          '`lookPrompt({ locale? })`: asks for one JSON object and nothing else.',
          '`parseLook(answer)`: never throws; unknown keys and values are dropped.',
        ],
      },
      { h: 'Without a model' },
      '`lookForRole` from `@awflow/avatar/compat` picks a look from what an agent does, by keywords:',
      {
        code: `import { toSvg } from '@awflow/avatar'
import { lookForRole } from '@awflow/avatar/compat'

const svg = toSvg('Trip planner', { theme: 'bold', ...lookForRole('Plans trips and books flights') })`,
        lang: 'ts',
        check: true,
      },
    ],
  },
  {
    slug: 'peek',
    group: 'Project',
    title: 'Coming from Peek',
    blurb: 'Pin the Peek style and every stored face stays byte-identical.',
    task: 'Migrate this app from @doan-labs/peek to @awflow/avatar without changing any existing face.',
    blocks: [
      `@awflow/avatar is built on [Peek](${PEEK}) by Doan Labs (MIT) and extends it. Pin the Peek style with \`style: 'peek@1'\` (or \`version: 1\`) and the output is byte-identical to \`@doan-labs/peek\` 1.2.0, ids included.`,
      {
        code: `import { toSvg } from '@awflow/avatar'

const same = toSvg('Linh', { style: 'peek@1' }) // what Peek drew`,
        lang: 'ts',
        check: true,
      },
      'In components, `style` is the CSS style of the svg, so pin the version with the `version` prop:',
      {
        code: `- import { Peek } from '@doan-labs/peek'
+ import { Avatar } from '@awflow/avatar-react'

- <Peek name="Linh" />
+ <Avatar name="Linh" version={1} />`,
        lang: 'diff',
      },
      {
        faces: [
          { name: 'Linh', version: 1, label: 'peek@1' },
          { name: 'Linh', label: `version ${LATEST}` },
        ],
        size: 96,
      },
      { h: 'What changes when you opt in' },
      {
        list: [
          'Version 2 adds shapes, colours, eyes, a mouth and motifs at the end of each list, so a name may draw a new face. Bump the version when you are ready.',
          'At version 1, `face` is the body silhouette, as in Peek. From version 2 the silhouette is `shape` and `face` is a decoration (an alias of `decor`).',
          'Ids start with `peek-` at version 1 and `awf-` from version 2.',
          "`toSvg` keeps its signature. React props are a superset of Peek's.",
        ],
      },
    ],
  },
  {
    slug: 'changelog',
    group: 'Project',
    title: 'Changelog',
    blurb: 'What shipped, and when.',
    task: 'Upgrade @awflow/avatar in this project to the latest version.',
    blocks: [
      { h: '1.0.0' },
      'First release.',
      {
        list: [
          `Core \`@awflow/avatar\`: ${SHAPES.length} shapes, ${LISTS.color.length} colours, ${THEME_NAMES.length} themes, ${EXPR.length} expressions, ${ACTS.length} activities, ${REACTS.length} reactions, drawing version \`${LATEST}\` with \`peek@1\` kept byte-identical.`,
          'Wardrobe: headwear, eyewear, neckwear and decor slots plus held props, with `dress`.',
          'Plugins: accessories, props, overlays, shapes and themes.',
          'Adapters: React, Svelte, Vue, Solid and the `<awf-avatar>` web component.',
          '`@awflow/avatar-export`: PNG, APNG, GIF and sprite sheets; `awflow-avatar` CLI.',
          '`@awflow/avatar/ai` and `@awflow/avatar/compat`.',
        ],
      },
    ],
  },
]

export const pagePath = (p: DocPage) => `/docs${p.slug ? `/${p.slug}` : ''}`
export const pageUrl = (p: DocPage) => `${SITE}${pagePath(p)}`

function table(rows: string[][]) {
  const [head = [], ...rest] = rows
  const row = (r: string[]) => `| ${r.join(' | ')} |`
  return [row(head), row(head.map(() => '---')), ...rest.map(row)].join('\n')
}

// site-relative links read as full URLs outside the site
const absolute = (s: string) => s.replace(/\]\(\//g, `](${SITE}/`)

const md = (b: Block): string | null => {
  if (typeof b === 'string') return absolute(b)
  if ('h' in b) return `## ${b.h}`
  if ('code' in b) return `\`\`\`${b.lang}\n${b.code}\n\`\`\``
  if ('list' in b) return b.list.map((i) => `- ${absolute(i)}`).join('\n')
  if ('rows' in b) return table(b.rows)
  if ('frameworks' in b)
    return FRAMEWORKS.map(
      (fw) =>
        `### ${fw}\n\n\`\`\`bash\n${INSTALL[fw]}\n\`\`\`\n\n\`\`\`\n${snippet(fw, b.frameworks.name, b.frameworks.look)}\n\`\`\``,
    ).join('\n\n')
  return null
}

export const toMarkdown = (p: DocPage) =>
  [`# ${p.title}`, p.blurb, ...p.blocks.map(md)].filter(Boolean).join('\n\n')

export const toPrompt = (p: DocPage) => `${p.task}

Use \`@awflow/avatar\` (built on Peek by Doan Labs). The full docs are at ${SITE}/llms-full.txt.
Below is the page for this task.

${toMarkdown(p)}
`

const INTRO =
  '# @awflow/avatar\n\n> A string in, a face out. Deterministic SVG avatars with expressions, agent activities, a wardrobe and a spring-driven rig. Zero runtime dependencies. Adapters for React, Svelte, Vue, Solid and a web component; PNG, GIF and sprite export; a CLI. Built on Peek by Doan Labs, made by AWFlow.'

export const llmsTxt = () => `${INTRO}

## Docs

${PAGES.map((p) => `- [${p.title}](${pageUrl(p)}): ${p.blurb}`).join('\n')}
- [Playground](${SITE}/playground): every prop, live, with code for each framework

## Optional

- [Full docs](${SITE}/llms-full.txt): every page above in one file
- [Source](${REPO}): the code, on GitHub
`

export const llmsFull = () =>
  `${INTRO}\n\n${PAGES.map(toMarkdown).join('\n\n---\n\n')}\n`

type CodeBlockData = Extract<Block, { code: string }>

/** The `nth` code block of a page, so the home page shows docs code. */
export function codeOf(slug: string, nth = 0): CodeBlockData {
  const page = PAGES.find((p) => p.slug === slug)
  const all = (page?.blocks ?? []).filter(
    (b): b is CodeBlockData => typeof b === 'object' && 'code' in b,
  )
  const b = all[nth]
  if (!b) throw new Error(`no code block ${nth} on /docs/${slug}`)
  return b
}

/** The first table of a page, header row left out. */
export function rowsOf(slug: string): string[][] {
  const page = PAGES.find((p) => p.slug === slug)
  const b = page?.blocks.find(
    (b): b is { rows: string[][] } => typeof b === 'object' && 'rows' in b,
  )
  if (!b) throw new Error(`no table on /docs/${slug}`)
  return b.rows.slice(1)
}
