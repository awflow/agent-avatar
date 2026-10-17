/*
 * Test-only: renders <Avatar> through svelte/server in a separate Bun
 * process, so a client test (whose module graph is compiled for the
 * browser) can hydrate real server markup. Reads a JSON array of props
 * from argv and prints a JSON array of { head, body } to stdout. The
 * .svelte files are compiled for the server by a Bun plugin; the core
 * resolves through the workspace's private awflow-src condition.
 */
import { plugin } from 'bun'
import { compile } from 'svelte/compiler'

plugin({
  name: 'svelte-server',
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const source = await Bun.file(path).text()
      const { js } = compile(source, {
        filename: path,
        generate: 'server',
        dev: false,
      })
      return { contents: js.code, loader: 'js' }
    })
  },
})

const { render } = await import('svelte/server')
const { default: Avatar } = await import('../src/avatar.svelte')
const list = JSON.parse(process.argv[2] ?? '[]') as Record<string, unknown>[]
const out = list.map((props) => {
  const { head, body } = render(Avatar, { props: props as never })
  return { head, body }
})
process.stdout.write(JSON.stringify(out))
