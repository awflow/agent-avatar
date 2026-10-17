import { LATEST } from '@awflow/avatar'

/**
 * The svg id prefix for a `$props.id()` value: `peek-` at version 1, `awf-`
 * from version 2, as the core's generated ids.
 */
export function domId(svelteId: string, version?: number): string {
  const prefix = (version ?? LATEST) >= 2 ? 'awf' : 'peek'
  return `${prefix}-${svelteId.replace(/[^\w-]/g, '')}`
}
