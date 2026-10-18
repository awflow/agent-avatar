/*
 * Node module hooks for the release smoke: compile `.svelte` files for the
 * server on load, and resolve the extensionless relative imports a Svelte
 * package's components use (`./group`), as a Svelte-aware bundler does.
 * Registered by runtime.mjs through `module.register`.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compile } from 'svelte/compiler'

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (e) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../')
    if (e?.code !== 'ERR_MODULE_NOT_FOUND' || !relative) throw e
    return next(`${specifier}.js`, context)
  }
}

export async function load(url, context, next) {
  if (!url.endsWith('.svelte')) return next(url, context)
  const filename = fileURLToPath(url)
  const source = await readFile(filename, 'utf8')
  const { js } = compile(source, { filename, generate: 'server' })
  return { format: 'module', source: js.code, shortCircuit: true }
}
