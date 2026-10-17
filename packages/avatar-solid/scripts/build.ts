/*
 * Compile the components for ordinary JS consumers: a hydratable DOM build
 * (dist/index.js) and a server build for renderToString (dist/server.js),
 * both through vite-plugin-solid, plus declarations. Solid and
 * @awflow/avatar stay external: one copy of each, the app's.
 */
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'

const outdir = 'dist'
await rm(outdir, { recursive: true, force: true })

for (const ssr of [false, true]) {
  await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [solid({ ssr: true, hot: false, dev: false })],
    build: {
      outDir: outdir,
      emptyOutDir: false,
      minify: false,
      target: 'es2022',
      ssr: ssr ? 'src/index.ts' : undefined,
      lib: {
        entry: 'src/index.ts',
        formats: ['es'],
        fileName: () => (ssr ? 'server.js' : 'index.js'),
      },
      rolldownOptions: {
        external: [/^solid-js(\/|$)/, /^@awflow\/avatar(\/|$)/],
        output: { entryFileNames: ssr ? 'server.js' : 'index.js' },
      },
    },
  })
}

const declarations = Bun.spawn(
  ['bunx', 'tsc', '-p', 'tsconfig.build.json', '--outDir', outdir],
  { stdout: 'inherit', stderr: 'inherit' },
)
if (await declarations.exited) process.exit(1)

// Node's ESM resolver requires extensions in declaration imports too.
for (const file of await readdir(outdir, { recursive: true })) {
  if (!file.endsWith('.d.ts')) continue
  const path = resolve(outdir, file)
  const source = await readFile(path, 'utf8')
  await writeFile(
    path,
    source.replace(
      /(from\s+['"])(\.\.?\/[^'"]+?)(?<!\.js)(['"])/g,
      '$1$2.js$3',
    ),
  )
}

// the server build has the same api, so the same declarations
await writeFile(resolve(outdir, 'server.d.ts'), "export * from './index.js'\n")

console.log(`built index.js, server.js and declarations into ${outdir}`)
