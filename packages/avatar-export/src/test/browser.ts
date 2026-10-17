/*
 * The browser path, run in its own process so the wasm starts uninitialised:
 * happy-dom supplies window, document and fetch, the wasm comes over HTTP
 * through init(fetch(url)), and the PNG goes to stdout as base64.
 */
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

const wasm = new Uint8Array(
  await Bun.file(
    Bun.resolveSync('@resvg/resvg-wasm/index_bg.wasm', import.meta.dir),
  ).arrayBuffer(),
)
const server = createServer((_, res) => {
  res.writeHead(200, {
    'content-type': 'application/wasm',
    'content-length': wasm.length,
  })
  res.end(wasm)
})
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
GlobalRegistrator.register({ url: `${origin}/` })
try {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    throw new Error('happy-dom did not register')
  const { init, toPng } = await import('../index')
  await init(fetch(`${origin}/resvg.wasm`))
  const png = await toPng('Linh')
  process.stdout.write(Buffer.from(png).toString('base64'))
} finally {
  await GlobalRegistrator.unregister()
  server.close()
}
