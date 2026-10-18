/*
 * The release runtime smoke, run by scripts/release.ts under plain Node
 * (>= 20) inside a temporary consumer that installed the packed tarballs.
 * Never run from the repo: every import resolves the way an app's would.
 *
 * 1. imports every public entry and checks that each value export its
 *    declarations promise (exports.json, written by release.ts from the
 *    shipped .d.ts files) exists at runtime
 * 2. the element: importing without a DOM defines nothing and does not
 *    throw; under happy-dom, <awf-avatar> renders an svg equal to toSvg
 * 3. React, Vue, Solid and Svelte (compiled by svelte/compiler) render on
 *    the server, each equal to toSvg for the same input
 * 4. both bins: an SVG from @awflow/avatar, a PNG from @awflow/avatar-export
 *
 * Markup is compared after normalising only what is documented to differ:
 * the svg id prefix (each framework derives its own unique id), comments
 * (framework hydration markers), the wrapper around the svg (Solid's
 * display:contents span) and how an empty element is closed (`<a/>` and
 * `<a></a>` are the same SVG).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const failures = []
const fail = (what, msg) => failures.push(`${what}: ${msg}`)
const ok = (msg) => console.log(`ok   ${msg}`)

const expected = JSON.parse(readFileSync('exports.json', 'utf8'))

/** The one svg element in `html`, normalised for comparison. */
function canon(html) {
  const start = html.indexOf('<svg')
  const end = html.lastIndexOf('</svg>')
  if (start < 0 || end < 0) return `NO SVG IN: ${html.slice(0, 200)}`
  let svg = html
    .slice(start, end + '</svg>'.length)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<([a-zA-Z][\w:-]*)([^<>]*?)><\/\1>/g, '<$1$2/>')
  const first = svg.match(/ id="([^"]+)-[^"-]+"/)
  if (first) svg = svg.split(first[1]).join('ID')
  return svg
}

function same(what, got, want) {
  const a = canon(got)
  const b = canon(want)
  if (a === b) return ok(what)
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  fail(
    what,
    `differs from toSvg at ${i}:\n    got  ${a.slice(Math.max(0, i - 40), i + 80)}\n    want ${b.slice(Math.max(0, i - 40), i + 80)}`,
  )
}

// .svelte components compile on load
register('./svelte-hooks.mjs', pathToFileURL(`${process.cwd()}/`))

// 2a. the element first, before any DOM exists
try {
  const element = await import('@awflow/avatar-element')
  if (typeof element.defineAvatarElements !== 'function')
    fail('@awflow/avatar-element', 'no defineAvatarElements function')
  element.defineAvatarElements()
  ok('@awflow/avatar-element imports in Node without a DOM')
} catch (e) {
  fail('@awflow/avatar-element', `import without a DOM threw: ${e}`)
}

// 1. every entry, every declared value export
const modules = {}
for (const [entry, names] of Object.entries(expected)) {
  try {
    const m = await import(entry)
    modules[entry] = m
    const missing = names.filter((n) => !(n in m))
    if (missing.length)
      fail(entry, `declared but missing at runtime: ${missing.join(', ')}`)
    else ok(`${entry}: ${names.length} value exports`)
  } catch (e) {
    fail(entry, `import failed: ${e?.stack?.split('\n')[0] ?? e}`)
  }
}

const { toSvg } = modules['@awflow/avatar'] ?? {}
if (typeof toSvg !== 'function') {
  console.error('the core did not import; nothing else can run')
  process.exit(1)
}

const CASES = [
  ['Linh', {}],
  ['Ada Lovelace', { theme: 'bold', expression: 'happy', size: 96 }],
  ['Grace Hopper', { framing: 'full', frame: 'bone', activity: 'thinking' }],
  ['東京', { version: 1, theme: 'mono' }],
]

// 3. server renders
const run = async (what, render) => {
  if (!modules[`@awflow/avatar-${what}`])
    return fail(`${what} SSR`, 'skipped: the adapter did not import')
  for (const [name, opts] of CASES) {
    const label = `${what} SSR ${name} ${JSON.stringify(opts)}`
    try {
      same(label, await render(name, opts), toSvg(name, opts))
    } catch (e) {
      fail(label, `threw: ${e?.stack?.split('\n')[0] ?? e}`)
    }
  }
}

const { createElement } = await import('react')
const { renderToString: reactSsr } = await import('react-dom/server')
await run('react', (name, opts) =>
  reactSsr(
    createElement(modules['@awflow/avatar-react'].Avatar, { name, ...opts }),
  ),
)

const { createSSRApp, h } = await import('vue')
const { renderToString: vueSsr } = await import('vue/server-renderer')
await run('vue', (name, opts) =>
  vueSsr(
    createSSRApp({
      render: () => h(modules['@awflow/avatar-vue'].Avatar, { name, ...opts }),
    }),
  ),
)

const solidWeb = await import('solid-js/web')
await run('solid', (name, opts) =>
  solidWeb.renderToString(() =>
    solidWeb.createComponent(modules['@awflow/avatar-solid'].Avatar, {
      name,
      ...opts,
    }),
  ),
)

const { render: svelteSsr } = await import('svelte/server')
await run(
  'svelte',
  (name, opts) =>
    svelteSsr(modules['@awflow/avatar-svelte'].Avatar, {
      props: { name, ...opts },
    }).body,
)

// 2b. the element under happy-dom
const element = modules['@awflow/avatar-element']
if (typeof element?.defineAvatarElements !== 'function')
  fail('element under happy-dom', 'skipped: the element did not import')
else {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  GlobalRegistrator.register()
  globalThis.IntersectionObserver ??= class {
    observe() {}
    disconnect() {}
  }
  element.defineAvatarElements()
  if (!customElements.get('awf-avatar'))
    fail('@awflow/avatar-element', '<awf-avatar> is not defined')
  for (const [name, opts] of CASES) {
    const label = `element <awf-avatar> ${name} ${JSON.stringify(opts)}`
    const el = document.createElement('awf-avatar')
    el.setAttribute('name', name)
    for (const [k, v] of Object.entries(opts)) el.setAttribute(k, String(v))
    document.body.append(el)
    await new Promise((r) => setTimeout(r, 0))
    const svgs = el.querySelectorAll('svg').length
    if (svgs !== 1) fail(label, `${svgs} svg elements rendered`)
    else {
      // both through the same serializer
      const want = document.createElement('div')
      want.innerHTML = toSvg(name, opts)
      same(label, el.innerHTML, want.innerHTML)
    }
    el.remove()
  }
  await GlobalRegistrator.unregister()
}

// 4. the bins
try {
  const svg = execFileSync('node_modules/.bin/awflow-avatar', ['Linh'], {
    encoding: 'utf8',
  })
  if (svg.trimEnd() !== toSvg('Linh')) fail('awflow-avatar', 'not toSvg')
  else ok('bin awflow-avatar Linh is toSvg')
  const png = execFileSync('node_modules/.bin/awflow-avatar-export', [
    'Linh',
    '--png',
    '32',
  ])
  if (png.subarray(1, 4).toString() !== 'PNG')
    fail('awflow-avatar-export', 'no PNG signature')
  else ok(`bin awflow-avatar-export Linh --png 32: ${png.length} bytes`)
} catch (e) {
  fail('bins', String(e?.message ?? e).split('\n')[0])
}

if (failures.length) {
  console.error(`\nruntime smoke: ${failures.length} failure(s)`)
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log('\nruntime smoke: every entry, adapter and bin works under Node')
